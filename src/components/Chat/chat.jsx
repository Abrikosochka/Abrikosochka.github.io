import { useEffect, useRef, useState } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import { supabase } from "../../lib/supabaseClient";
import { getChatMessages, setChatMessages, addMessage, setLastMessage } from "../../lib/auth";
import ChatSettings from './ChatSetting/ChatSettings';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import { getCurrentUser } from '../../lib/auth';

const checkSupabaseConnection = async () => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('count')
            .limit(1);
            
        return !error;
    } catch (error) {
        console.error('Ошибка проверки подключения:', error);
        return false;
    }
};

function Chat() {
    console.log('Chat component initialized');
    
    const { currentUser } = useUserStore();
    const { currentChat, clearCurrentChat } = useChatStore();

    // Добавляем подробные логи
    console.log('=== Chat Component Debug ===');
    console.log('currentUser:', currentUser);
    console.log('currentChat:', currentChat);

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Добавим useEffect для отслеживания изменений currentChat
    useEffect(() => {
        console.log('=== Chat Updated ===');
        console.log('Updated currentChat:', currentChat);
        console.log('Updated currentUser:', currentUser);
        
        if (currentChat && currentUser) {
            console.log('Chat members:', currentChat.members);
            console.log('User ID:', currentUser.id);
            console.log('Members contains user:', currentChat.members?.[currentUser.id.toString()]);
        }
    }, [currentChat, currentUser]);

    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [error, setError] = useState(null);

    const limit = 20;
    const endRef = useRef(null);
    const topRef = useRef(null);

    // Добавляем ref для хранения предыдущего значения чата
    const prevChatRef = useRef();

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Функция загрузки дополнительных сообщений
    const loadMoreMessages = async () => {
        if (!currentChat || isLoadingMore || !hasMore) return;

        try {
            setIsLoadingMore(true);
            const newOffset = offset + limit;

            const { data, error } = await supabase.rpc('get_chat_messages', {
                chat_id_param: parseInt(currentChat.chat_id),
                limit_param: limit,
                offset_param: newOffset
            });

            if (error) throw error;

            if (data) {
                const formattedMessages = data.map(msg => ({
                    message_id: msg.message_id,
                    chat_id: msg.chat_id,
                    sender_id: msg.sender_id,
                    content: msg.content,
                    date: msg.date,
                    sender_username: msg.sender_username,
                    sender_avatar: msg.sender_avatar,
                    is_edit: msg.is_edit
                })).reverse();

                if (formattedMessages.length < limit) {
                    setHasMore(false);
                }

                setMessages(prevMessages => [...formattedMessages, ...prevMessages]);
                setOffset(newOffset);
            }
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
            setError('Не удалось загрузить дополнительные сообщения');
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Обработчик скролла
    const handleScroll = (e) => {
        const { scrollTop } = e.target;
        if (scrollTop === 0 && !isLoadingMore && hasMore) {
            // Сохраняем текущую позицию скролла
            const scrollHeight = e.target.scrollHeight;
            
            loadMoreMessages().then(() => {
                // Восстанавливаем позицию скролла после загрузки
                const newScrollHeight = e.target.scrollHeight;
                const scrollDiff = newScrollHeight - scrollHeight;
                e.target.scrollTop = scrollDiff;
            });
        }
    };

    // Обновляем loadInitialMessages
    const loadInitialMessages = async () => {
        if (!currentChat) return;

        try {
            setLoading(true);
            setOffset(0);
            setHasMore(true);
            
            const { data, error } = await supabase.rpc('get_chat_messages', {
                chat_id_param: parseInt(currentChat.chat_id),
                limit_param: limit,
                offset_param: 0
            });

            if (error) throw error;

            if (data) {
                const formattedMessages = data.map(msg => ({
                    message_id: msg.message_id,
                    chat_id: msg.chat_id,
                    sender_id: msg.sender_id,
                    content: msg.content,
                    date: msg.date,
                    sender_username: msg.sender_username,
                    sender_avatar: msg.sender_avatar,
                    is_edit: msg.is_edit
                })).reverse();

                if (formattedMessages.length < limit) {
                    setHasMore(false);
                }

                setMessages(formattedMessages);
                setChatMessages(currentChat.chat_id, formattedMessages);

                setTimeout(() => {
                    endRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 300);
            }
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
            setError('Не удалось загрузить сообщения');
        } finally {
            setLoading(false);
        }
    };

    // Обновляем useEffect для загрузки сообщений
    useEffect(() => {
        if (currentChat) {
            loadInitialMessages();
        }
    }, [currentChat?.chat_id]);

    const handleEmoji = (e) => {
        setText(text => text + e.emoji);
        setOpen(false);
    };

    const handleSend = async () => {
        if (!text.trim() || !currentChat) return;

        try {
            const currentUserId = currentUser.id.toString();
            const otherUserId = Object.keys(currentChat.members)
                .find(id => id !== currentUserId);
            
            // Проверяем блокировку в обе стороны
            const isBlockedByOther = currentChat.members[currentUserId]?.blocked_user;
            const hasBlockedOther = currentChat.members[otherUserId]?.blocked_user;
            const isBlocked = isBlockedByOther || hasBlockedOther;

            // Если чат заблокирован, просто выходим из функции
            if (!currentChat.is_group && isBlocked) return;

            console.log(currentChat);
            // Сохраняем текст сообщения и очищаем поле ввода
            const messageText = text.trim();
            setText('');

            const { data, error } = await supabase.rpc('add_message', {
                p_chat_id: parseInt(currentChat.chat_id),
                p_sender_id: parseInt(currentUser.id),
                p_content: messageText,
                p_media: null
            });

            if (error) {
                throw error;
            }

            // Обновляем последнее сообщение
            setLastMessage(currentChat.chat_id, {
                content: messageText,
                date: new Date().toISOString(),
                sender_name: currentUser.username
            });

            // Прокручиваем к последнему сообщению
            setTimeout(() => {
                endRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 300);

        } catch (error) {
            if(error.message === 
                "Вы заблокированы в этом чате") {
                console.error('Ошибка отправки сообщения:', error);
                setText(text);
                setError('Вы заблокированны в этом чате');
            }
            else {
                console.error('Ошибка отправки сообщения:', error);
                setText(text);
                setError('Ошибка при отправке сообщения');
            }
        }
    };

    // Обновляем useEffect для подписки на изменения
    useEffect(() => {
        if (!currentChat) return;

        console.log('Подписываемся на изменения чата:', currentChat.chat_id);

        // Загружаем начальные сообщения
        loadInitialMessages();

        const channelA = supabase.channel('any').on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${currentChat.chat_id}`,
            },
            async (payload) => {
                console.log('Новое сообщение:', payload);

                try {
                    // Получаем данные отправителя
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('username, avatar')
                        .eq('id', payload.new.sender_id)
                        .single();

                    if (userError) throw userError;

                    // Добавляем новое сообщение к существующим
                    const newMessage = {
                        message_id: payload.new.id,
                        chat_id: payload.new.chat_id,
                        sender_id: payload.new.sender_id,
                        content: payload.new.content,
                        date: payload.new.date,
                        is_edit: payload.new.is_edit,
                        sender_username: userData.username,
                        sender_avatar: userData.avatar || "/avatar.png" // Добавляем дефолтную аватарку
                    };

                    // Обновляем состояние и localStorage
                    setMessages(prevMessages => {
                        const updatedMessages = [...prevMessages, newMessage];
                        setChatMessages(currentChat.chat_id, updatedMessages);
                        return updatedMessages;
                    });

                    // Обновляем последнее сообщение
                    setLastMessage(currentChat.chat_id, {
                        content: newMessage.content,
                        date: newMessage.date,
                        sender_name: userData.username
                    });

                    // Прокручиваем к новому сообщению если это не наше сообщение
                    if (newMessage.sender_id !== parseInt(currentUser.id)) {
                        setTimeout(() => {
                            endRef.current?.scrollIntoView({ behavior: "smooth" });
                        }, 300);
                    }
                } catch (error) {
                    console.error('Ошибка при обработке нового сообщения:', error);
                }
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'messages'
            },
            (payload) => {
                console.log('Получено событие удаления:', payload);
                
                // Обработка удаления сообщения
                setMessages(prevMessages => {
                    console.log('Текущие сообщения:', prevMessages);
                    console.log('Удаляемое ID:', payload.old.id);
                    
                    const updatedMessages = prevMessages.filter(
                        message => message.message_id !== payload.old.id
                    );
                    
                    console.log('Обновленные сообщения:', updatedMessages);
                    setChatMessages(currentChat.chat_id, updatedMessages);
                    return updatedMessages;
                });

                // // Обновление последнего сообщения, если удалено оно
                // const wasLastMessage = messages[messages.length - 1]?.message_id === payload.old.id;
                // if (wasLastMessage) {
                //     setLastMessage(currentChat.chat_id, null);
                // }
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${currentChat.chat_id}`,
            },
            async (payload) => {
                console.log('Сообщение обновлено:', payload);

                // Обработка редактирования сообщения
                setMessages(prevMessages => {
                    const updatedMessages = prevMessages.map(message =>
                        message.message_id === payload.new.id
                            ? { ...message, content: payload.new.content, is_edit: true }
                            : message
                    );
                    setChatMessages(currentChat.chat_id, updatedMessages);
                    return updatedMessages;
                });

                // Обновление последнего сообщения, если оно редактировалось
                // setLastMessage(currentChat.chat_id, {
                //     content: payload.new.content,
                //     date: payload.new.date,
                //     sender_name: payload.new.sender_id, // Используйте username из payload или получите через запрос
                // });
            }
        );

        // Подписка на изменения
        channelA.subscribe();

        // Очистка подписки при размонтировании компонента
        return () => {
            channelA.unsubscribe();
        };
    }, [currentChat]);

    // Добавить функцию форматирования времени
    const formatDate = (date) => {
        // Создаем дату и добавляем 3 часа
        const d = new Date(date);
        d.setHours(d.getHours() + 3);  // Добавляем 3 часа
        
        const now = new Date();
        const diff = now - d;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        // Если сообщение отправлено сегодня, показываем только время
        if (days === 0) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        // Если вчера
        else if (days === 1) {
            return 'вчера ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        // Если на этой неделе
        else if (days < 7) {
            const options = { weekday: 'short', hour: '2-digit', minute: '2-digit' };
            return d.toLocaleString('ru-RU', options);
        }
        // Иначе показываем полную дату
        else {
            const options = { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' };
            return d.toLocaleString('ru-RU', options);
        }
    };

    useEffect(() => {
        const checkConnection = async () => {
            const isConnected = await checkSupabaseConnection();
            if (!isConnected) {
                alert('Проблема с подключением к серверу. Попробуйте обновить страницу.');
            }
        };

        checkConnection();
    }, []);

    const handleChatUpdate = async () => {
        try {
            // Перезагружаем сообщения
            setOffset(0);
            setAllMessagesLoaded(false);
            setMessages([]); 
            await loadMessagesWithRetry(0);
            
            // Прокручиваем к последнему сообщению
            setTimeout(() => {
                endRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        } catch (error) {
            console.error('Ошибка при обновлении чата:', error);
        }
    };

    const renderChatInput = () => {
        if (!currentChat || !currentChat.members || !currentUser) {
            return (
                <div className="bottom">
                    <input 
                        type="text" 
                        placeholder="Загрузка..." 
                        disabled={true}
                    />
                </div>
            );
        }

        const currentUserId = currentUser.id.toString();
        const otherUserId = Object.keys(currentChat.members)
            .find(id => id !== currentUserId);
        
        // Проверяем блокировку в обе стороны
        const isBlockedByOther = currentChat.members[currentUserId]?.blocked_user;
        const hasBlockedOther = currentChat.members[otherUserId]?.blocked_user;
        const isBlocked = !currentChat.is_group && (isBlockedByOther || hasBlockedOther);

        // Определяем текст сообщения о блокировке
        let blockMessage = '';
        if (isBlockedByOther) {
            blockMessage = 'Вы заблокированы в этом чате';
        } else if (hasBlockedOther) {
            blockMessage = 'Вы заблокировали этого пользователя';
        }

        return (
            <div className="bottom">
                {isBlocked && (
                    <div className="block-message">
                        {blockMessage}
                    </div>
                )}
                <input 
                    type="text" 
                    placeholder={isBlocked ? "Отправка сообщений недоступна" : "Введите сообщение..."} 
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isBlocked}
                />
                <div className="emoji">
                    <img 
                        src="/emoji.png"
                        alt="emoji" 
                        onClick={() => !isBlocked && setOpen(!open)}
                        style={{ opacity: isBlocked ? 0.5 : 1 }}
                    />
                    <div className="picker">
                        <EmojiPicker 
                            open={open && !isBlocked} 
                            onEmojiClick={handleEmoji}
                        />
                    </div>
                </div>
                <button 
                    className="sendButton" 
                    onClick={handleSend}
                    disabled={!currentChat.is_group && isBlocked}
                    style={{ opacity: isBlocked ? 0.5 : 1 }}
                >
                    Отправить
                </button>
            </div>
        );
    };

    const [editingMessage, setEditingMessage] = useState(null);
    const [editText, setEditText] = useState("");
    const [noEditText, setNoEditText] = useState("");

    const handleEdit = (message) => {
        setEditingMessage(message);
        setEditText(message.content);
        setNoEditText(message.content);
    };

    const handleDelete = async (messageId) => {
        try {
            console.log('Пытаемся удалить сообщение:', messageId);
            
            const { data, error } = await supabase.rpc('delete_messages', {
                p_message_id: messageId,
                p_user_id: parseInt(currentUser.id)
            });

            console.log('Ответ от сервера:', { data, error });

            if (error) throw error;
            if (!data) {
                throw new Error('У вас нет прав на удаление этого сообщения');
            }

            // Обновляем список сообщений
            setMessages(prevMessages => {
                const updatedMessages = prevMessages.filter(msg => msg.message_id !== messageId);
                setChatMessages(currentChat.chat_id, updatedMessages);
                return updatedMessages;
            });

            // Если удалили последнее сообщение, обновляем lastMessage
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.message_id === messageId) {
                const newLastMsg = messages[messages.length - 2];
                if (newLastMsg) {
                    setLastMessage(currentChat.chat_id, {
                        content: newLastMsg.content,
                        date: newLastMsg.date,
                        sender_name: newLastMsg.sender_username
                    });
                }
                else {
                    setLastMessage(currentChat.chat_id, {
                        content: null,
                        date: null,
                        sender_name: null
                    });
                }
            }

        } catch (error) {
            console.error('Подробная ошибка при удалении:', error);
            setError(`Не удалось удалить сообщение: ${error.message}`);
        }
    };

    const handleSaveEdit = async () => {
        if (!editText.trim()) return;

        if (editText.trim() === noEditText.trim()) return;

        try {
            const { error: editError } = await supabase.rpc('edit_message', {
                p_message_id: editingMessage.message_id,
                p_user_id: parseInt(currentUser.id),
                p_content: editText.trim()
            });

            if (editError) throw editError;

            // Обновляем сообщение в списке
            setMessages(prevMessages => {
                const updatedMessages = prevMessages.map(msg =>
                    msg.message_id === editingMessage.message_id
                        ? { ...msg, content: editText.trim(), is_edit: true }
                        : msg
                );  
                setChatMessages(currentChat.chat_id, updatedMessages);
                return updatedMessages;
            });

            // Обновляем последнее сообщение если редактировали последнее
            if (messages[messages.length - 1].message_id === editingMessage.message_id) {
                setLastMessage(currentChat.chat_id, {
                    content: editText.trim(),
                    date: editingMessage.date,
                    sender_name: editingMessage.sender_username
                });
            }

            setEditingMessage(null);
            setEditText("");
        } catch (error) {
            console.error('Ошибка при редактировании сообщения:', error);
            setError('Не удалось редактировать сообщение');
        }
    };

    // Обновляем рендер сообщений
    const renderMessage = (message) => (
        <div 
            className={`message ${message.sender_id === parseInt(currentUser.id) ? "own" : ""}`}
            key={message.message_id}
        >
            {message.sender_id !== parseInt(currentUser.id) && (
                <img 
                    src={message.sender_avatar || "/avatar.png"}
                    alt="avatar"
                    className="user-avatar"
                />
            )}
            <div className="texts">
                {currentChat.is_group && message.sender_id !== parseInt(currentUser.id) && (
                    <span className="sender-name">{message.sender_username}</span>
                )}
                {editingMessage?.message_id === message.message_id ? (
                    <div>
                        <input
                            type="text"
                            className="edit-input"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleSaveEdit();
                                }
                            }}
                            autoFocus
                        />
                        <div className="message-actions">
                            <button onClick={handleSaveEdit}>Сохранить</button>
                            <button onClick={() => setEditingMessage(null)}>Отмена</button>
                        </div>
                    </div>
                ) : (
                    <p>
                        {message.content}
                        {message.is_edit && <span className="edited-mark">(ред.)</span>}
                    </p>
                )}
                <span className="message-time">{formatDate(message.date)}</span>
            </div>
            {message.sender_id === parseInt(currentUser.id) && !editingMessage && (
                <div className="message-actions">
                    <button onClick={() => handleEdit(message)}>✎</button>
                    <button onClick={() => handleDelete(message.message_id)}>✖</button>
                </div>
            )}
        </div>
    );

    if (!currentChat || !currentUser) {
        return <div className="chat no-chat">Выберите чат для начала общения</div>;
    }

    return (
        <div className="chat">
            {error && (
                <ErrorMessage 
                    message={error} 
                    onClose={() => setError(null)}
                />
            )}
            <div className="top">
                <div className="user" onClick={() => setShowSettings(true)}>
                    <img 
                        src={currentChat.displayImage} 
                        alt="avatar"
                    />
                    <div className="texts">
                        <span>{currentChat.displayName}</span>
                        <p>{currentChat.displayStatus}</p>
                    </div>
                </div>
                <div className="chat-controls">
                    <button 
                        className="hide-chat-btn"
                        onClick={() => clearCurrentChat()}
                        title="Скрыть чат"
                    >
                        –
                    </button>
                </div>
            </div>

            {showSettings && (
                <ChatSettings
                    chat={currentChat}
                    currentUser={currentUser}
                    onClose={() => setShowSettings(false)}
                    onUpdate={handleChatUpdate}
                />
            )}

            <div className="center" ref={topRef} onScroll={handleScroll}>
                {isLoadingMore && <div className="loading">Загрузка предыдущих сообщений...</div>}
                {messages.map(renderMessage)}
                <div ref={endRef}></div>
            </div>

            {renderChatInput()}
        </div>
    );
}

export default Chat;