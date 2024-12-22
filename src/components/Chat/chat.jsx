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
    const { currentChat } = useChatStore();

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
    const [offset, setOffset] = useState(0);
    const [allMessagesLoaded, setAllMessagesLoaded] = useState(false);
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

    // Добавляем функцию для повторных попыток загрузки
    const loadMessagesWithRetry = async (offsetValue = 0, retries = 3) => {
        if (!currentChat) return;

        // Проверяем подключение перед загрузкой
        const isConnected = await checkSupabaseConnection();
        if (!isConnected) {
            console.error('Нет подключения к Supabase');
            alert('Проблема с подключением к серверу. Проверьте интернет-соединение.');
            return;
        }

        for (let i = 0; i < retries; i++) {
            try {
                setLoading(true);
                
                // Увеличиваем timeout для запроса
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                );
                
                const fetchPromise = supabase
                    .from('messages')
                    .select(`
                        *,
                        users:sender_id (
                            username,
                            avatar
                        )
                    `)
                    .eq('chat_id', currentChat.chat_id)
                    .order('date', { ascending: true });

                const response = await Promise.race([fetchPromise, timeoutPromise]);
                const { data, error } = response;

                if (error) throw error;

                if (data) {
                    const formattedMessages = data.map(msg => ({
                        message_id: msg.id,
                        chat_id: msg.chat_id,
                        sender_id: msg.sender_id,
                        content: msg.content,
                        date: msg.date,
                        sender_username: msg.users?.username,
                        sender_avatar: msg.users?.avatar
                    }));

                    setMessages(formattedMessages);
                    setChatMessages(currentChat.chat_id, formattedMessages);

                    if (formattedMessages.length > 0) {
                        const lastMsg = formattedMessages[formattedMessages.length - 1];
                        setLastMessage(currentChat.chat_id, {
                            content: lastMsg.content,
                            date: lastMsg.date,
                            sender_name: lastMsg.sender_username
                        });
                    }
                    return;
                }
            } catch (error) {
                console.error(`Попытка ${i + 1}/${retries} загрузки сообщений не удалась:`, error);
                
                // Проверяем тип ошибки
                if (error.message === 'Timeout') {
                    console.log('Превышено время ожидания запроса');
                }
                
                if (i === retries - 1) {
                    console.error('Все попытки загрузки сообщений исчерпаны');
                    alert('Не удалось загрузить сообщения. Попробуйте обновить страницу.');
                } else {
                    // Увеличиваем время ожидания между попытками
                    await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
                }
            } finally {
                setLoading(false);
            }
        }
    };

    const loadInitialMessages = async () => {
        if (!currentChat) return;

        try {
            setLoading(true);
            
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
                    sender_avatar: msg.sender_avatar
                }));

                setMessages(formattedMessages);
                setChatMessages(currentChat.chat_id, formattedMessages);
            }
        } catch (error) {
            console.error('Ошибка загрузки начальных сообщений:', error);
        } finally {
            setLoading(false);
        }
    };

    // Загрузка сообщений при выборе чата
    useEffect(() => {
        if (currentChat) {
            // Проверяем, действительно ли изменился ID чата
            const chatIdChanged = !prevChatRef.current || 
                                prevChatRef.current.chat_id !== currentChat.chat_id;
            
            if (chatIdChanged) {
                loadInitialMessages();
                prevChatRef.current = currentChat;
            }
        }
    }, [currentChat?.chat_id]); // Следим только за ID чата

    // Обработка скролла для подгрузки старых сообщений
    const handleScroll = async () => {
        const { scrollTop } = topRef.current;
        if (scrollTop === 0 && !loading && !allMessagesLoaded) {
            await loadMessagesWithRetry(offset);
        }
    };

    const handleEmoji = (e) => {
        setText(text => text + e.emoji);
        setOpen(false);
    };

    const handleSend = async () => {
        if (!text.trim() || !currentChat) return;

        try {
            // Проверяем блокировку перед отправкой
            const isBlocked = currentChat.members?.[currentUser.id]?.blocked_user;
            if (isBlocked) {
                setError('Вы не можете отправлять сообщения в этот чат');
                return;
            }

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

            // Прокручиваем к последнему сообщению с увеличенной задержкой
            setTimeout(() => {
                endRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 300);

        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            setText(text);
            
            if (error.message && error.message.includes('Вы заблокированы в этом чате')) {
                setError('Вы не можете отправлять сообщения в этот чат');
            } else {
                setError('Ошибка при отправке сообщения');
            }
        }
    };

    // Обновляем useEffect для подписки на изменения
    useEffect(() => {
        if (!currentChat) return;

        console.log('Подписываемся на изменения чата:', currentChat.chat_id);

        // Загружаем начальные сообщения
        loadMessagesWithRetry(0);

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
        );

        // Подписываемся на канал
        channelA.subscribe((status) => {
            console.log(`Статус подписки для чата ${currentChat.chat_id}:`, status);
        });

        // Отписываемся при размонтировании компонента или смене чата
        return () => {
            console.log('Отписываемся от чата:', currentChat.chat_id);
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
        console.log('=== Rendering Chat Input ===');
        console.log('Current Chat State:', {
            currentChat,
            currentUser,
            hasMembers: Boolean(currentChat?.members),
            membersContent: currentChat?.members
        });

        if (!currentChat || !currentChat.members || !currentUser) {
            console.log('Missing required data for chat input');
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
        const isBlocked = currentChat.members?.[currentUserId]?.blocked_user;

        console.log('Chat Input State:', {
            currentUserId,
            members: currentChat.members,
            isBlocked
        });

        return (
            <div className="bottom">
                <input 
                    type="text" 
                    placeholder="Введите сообщение..." 
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
                    disabled={isBlocked}
                    style={{ opacity: isBlocked ? 0.5 : 1 }}
                >
                    Отправить
                </button>
            </div>
        );
    };

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
                {loading && <div className="loading">Загрузка сообщений...</div>}
                
                {messages.slice().map((message) => (
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
                            <p>{message.content}</p>
                            <span className="message-time">{formatDate(message.date)}</span>
                        </div>
                    </div>
                ))}
                
                <div ref={endRef}></div>
            </div>

            {renderChatInput()}
        </div>
    );
}

export default Chat;