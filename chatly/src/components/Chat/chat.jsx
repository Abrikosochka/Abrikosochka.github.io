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
            
            const { data, error } = await supabase.rpc('get_chat_messages', {
                chat_id_param: currentChat.chat_id,
                limit_param: limit,
                offset_param: offsetValue
            });

            if (error) {
                console.error('Ошибка загрузки сообщений:', error);
                return;
            }

            if (data && Array.isArray(data)) {
                setMessages(data);
            }

        } catch (error) {
            console.error('Ошибка при загрузке сообщений:', error);
        } finally {
            setLoading(false);
        }
    };

    // Загрузка сообщений при выборе чата
    useEffect(() => {
        if (currentChat) {
            loadMessages(0);
        }
    }, [currentChat?.chat_id]);

    // Обработка скролла для подгрузки старых сообщений
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
            const { error } = await supabase.rpc('add_message', {
                p_chat_id: parseInt(currentChat.chat_id),
                p_sender_id: parseInt(currentUser.id),
                p_content: text,
                p_media: null
            });

            if (error) throw error;

            setText('');
            // После отправки перезагружаем сообщения
            await loadMessages(0);
            
            setTimeout(() => {
                endRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);

        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            toast.error('Ошибка при отправке сообщения');
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
            }, () => {
                // При получении нового сообщения просто перезагружаем все сообщения
                loadMessages(0);
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