import { useEffect, useRef, useState } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import { supabase } from "../../lib/supabaseClient";
import { getChatMessages, setChatMessages, addMessage, setLastMessage } from "../../lib/auth";
import ChatSettings from './ChatSetting/ChatSettings';

function Chat() {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [offset, setOffset] = useState(0);
    const [allMessagesLoaded, setAllMessagesLoaded] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const limit = 20;
    const endRef = useRef(null);
    const topRef = useRef(null);

    const { currentUser } = useUserStore();
    const { currentChat } = useChatStore();

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Загрузка сообщений
    const loadMessages = async (offsetValue = 0) => {
        if (!currentChat) return;

        try {
            setLoading(true);
            
            // Получаем сообщения из базы данных
            const { data, error } = await supabase
                .rpc('get_chat_messages', {
                    chat_id_param: currentChat.chat_id,
                    limit_param: limit,
                    offset_param: offsetValue
                });

            if (error) {
                console.error('Ошибка загрузки сообщений:', error);
                return;
            }

            if (data && Array.isArray(data)) {
                // Если это первая загрузка (offset = 0), заменяем все сообщения
                if (offsetValue === 0) {
                    setMessages(data);
                    setChatMessages(currentChat.chat_id, data);
                } else {
                    // Иначе добавляем новые сообщения к существующим
                    const newMessages = [...data, ...messages];
                    setMessages(newMessages);
                    setChatMessages(currentChat.chat_id, newMessages);
                }

                // Проверяем, есть ли еще сообщения для загрузки
                setAllMessagesLoaded(data.length < limit);
                setOffset(offsetValue + data.length);
            }
        } catch (error) {
            console.error('Ошибка при загрузке сообщений:', error);
        } finally {
            setLoading(false);
        }
    };

    // Обновляем useEffect для загрузки сообщений при выборе чата
    useEffect(() => {
        if (currentChat) {
            console.log('Загрузка сообщений для чата:', currentChat.chat_id);
            setOffset(0);
            setAllMessagesLoaded(false);
            setMessages([]); // Очищаем сообщения перед загрузкой новых
            loadMessages(0);
        }
    }, [currentChat?.chat_id]); // Зависимость от chat_id вместо всего объекта currentChat

    // Обработка скролла
    const handleScroll = async () => {
        const { scrollTop } = topRef.current;
        if (scrollTop === 0 && !loading && !allMessagesLoaded) {
            await loadMessages(offset);
        }
    };

    const handleEmoji = (e) => {
        setText(text => text + e.emoji);
        setOpen(false);
    };

    const handleSend = async () => {
        if (!text.trim() || !currentChat) return;

        try {
            const { data, error } = await supabase.rpc('add_message', {
                p_chat_id: parseInt(currentChat.chat_id),
                p_sender_id: parseInt(currentUser.id),
                p_content: text,
                p_media: null
            });

            if (error) {
                console.error('Ошибка базы данных:', error);
                throw error;
            }

            if (data && data[0]) {
                const newMessage = {
                    message_id: data[0].id,
                    chat_id: data[0].chat_id,
                    sender_id: data[0].sender_id,
                    content: data[0].content,
                    date: data[0].date,
                    is_edit: data[0].is_edit,
                    is_read: data[0].is_read,
                    sender_username: currentUser.username,
                    sender_avatar: currentUser.avatar
                };

                // Обновляем состояние и localStorage
                setMessages(prev => [...prev, newMessage]);
                const updatedMessages = addMessage(currentChat.chat_id, newMessage);
                setChatMessages(currentChat.chat_id, updatedMessages);

                // Обновляем последнее сообщение
                setLastMessage(currentChat.chat_id, {
                    content: text,
                    sender_id: currentUser.id,
                    sender_name: currentUser.username,
                    date: data[0].date,
                    sender_avatar: currentUser.avatar
                });

                setText('');
                
                setTimeout(() => {
                    endRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);
            }
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            alert(error.message || 'Ошибка при отправке сообщения');
        }
    };

    // Подписка на новые сообщения
    useEffect(() => {
        if (!currentChat) return;

        const subscription = supabase
            .channel(`chat:${currentChat.chat_id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${currentChat.chat_id}`
            }, (payload) => {
                const newMessage = {
                    message_id: payload.new.id,
                    chat_id: payload.new.chat_id,
                    sender_id: payload.new.sender_id,
                    content: payload.new.content,
                    date: payload.new.date,
                    is_edit: payload.new.is_edit,
                    is_read: payload.new.is_read,
                    sender_username: payload.new.sender_username,
                    sender_avatar: payload.new.sender_avatar
                };
                const updatedMessages = addMessage(currentChat.chat_id, newMessage);
                setMessages(updatedMessages);

                // Обновляем последнее сообщение
                setLastMessage(currentChat.chat_id, {
                    content: newMessage.content,
                    sender_id: newMessage.sender_id,
                    sender_name: newMessage.sender_username,
                    date: newMessage.date,
                    media: newMessage.media,
                    sender_avatar: newMessage.sender_avatar
                });

                endRef.current?.scrollIntoView({ behavior: "smooth" });
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
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
            await loadMessages(0);
            
            // Прокручиваем к последнему сообщению
            setTimeout(() => {
                endRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        } catch (error) {
            console.error('Ошибка при обновлении чата:', error);
        }
    };

    if (!currentChat) {
        return <div className="chat no-chat">Выберите чат для начала общения</div>;
    }

    return (
        <div className="chat">
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

            <div className="bottom">
                <input 
                    type="text" 
                    placeholder="Type a message..." 
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyPress={handleKeyPress}
                />
                <div className="emoji">
                    <img 
                        src="/emoji.png"
                        alt="emoji" 
                        onClick={() => setOpen(!open)}
                    />
                    <div className="picker">
                        <EmojiPicker 
                            open={open} 
                            onEmojiClick={handleEmoji}
                        />
                    </div>
                </div>
                <button 
                    className="sendButton" 
                    onClick={handleSend}
                >
                    Send
                </button>
            </div>
        </div>
    );
}

export default Chat;