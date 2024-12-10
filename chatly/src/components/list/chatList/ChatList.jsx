import "./chatList.css"
import { getCurrentUserId, getCurrentUser, getLastMessage } from '../../../lib/auth'
import { setUserChats } from "../../../lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient.js";
import { useChatStore } from '../../../lib/chatStore';
import AddUser from './addUser/AddUser';

const formatDate = (date) => {
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
        return 'вчера';
    }
    // Если на этой неделе
    else if (days < 7) {
        const options = { weekday: 'short' };
        return d.toLocaleString('ru-RU', options);
    }
    // Иначе показываем дату
    else {
        const options = { day: '2-digit', month: '2-digit', year: '2-digit' };
        return d.toLocaleString('ru-RU', options);
    }
};

function ChatList() {
    const userId = getCurrentUserId();
    const currentUser = getCurrentUser();
    const [processedChats, setProcessedChats] = useState([]);
    const [addMode, setAddMode] = useState(false);
    const [inputText, setInputText] = useState("");
    const { setCurrentChat } = useChatStore();
    const [lastMessages, setLastMessages] = useState({});

    // Получение чатов
    useEffect(() => {
        const fetchChats = async () => {
            if (!userId) {
                console.error('userId отсутствует');
                return;
            }

            try {
                console.log('Fetching chats for user:', userId);
                const { data, error } = await supabase.rpc('get_user_chats', {
                    user_id_param: parseInt(userId)
                });

                if (error) {
                    console.error('Ошибка Supabase:', error);
                    return;
                }

                if (!data) {
                    console.error('Данные не получены');
                    return;
                }

                console.log('Received raw data from supabase:', data);

                const validChats = data
                    .filter(chat => chat)
                    .map(chat => {
                        console.log('Processing chat:', chat);
                        const members = chat.members || {};
                        
                        if (chat.is_group) {
                            const processedChat = {
                                ...chat,
                                displayName: chat.chat_name || `Групповой чат ${chat.chat_id}`,
                                displayImage: chat.chat_picture || "/group-avatar.png",
                                displayStatus: ''
                            };
                            console.log('Processed group chat:', processedChat);
                            return processedChat;
                        } else {
                            const otherUser = Object.values(members).find(member => member.id !== parseInt(userId)) || {};
                            const isBlocked = currentUser?.blocked?.includes(otherUser.id);
                            
                            const processedChat = {
                                ...chat,
                                displayName: isBlocked ? "User" : otherUser.username || 'Неизвестный пользователь',
                                displayImage: isBlocked ? "/avatar.png" : otherUser.avatar || "/avatar.png",
                                displayStatus: otherUser.status || 'Нет статуса'
                            };
                            console.log('Processed personal chat:', processedChat);
                            return processedChat;
                        }
                    });

                console.log('Final processed chats:', validChats);
                setProcessedChats(validChats);
            } catch (error) {
                console.error('Ошибка при получении чатов:', error);
            }
        };

        fetchChats();
    }, [userId]); // Зависимость только от userId

    // Фильтрация обработанных чатов
    const filteredChats = processedChats.filter(chat => {
        if (!chat) return false;
        return chat.displayName.toLowerCase().includes(inputText.toLowerCase());
    });

    const handleChatClick = (chat) => {
        console.log('Clicked chat:', chat);
        
        if (!chat || !chat.chat_id) {
            console.error('Invalid chat data:', chat);
            return;
        }

        // Просто устанавливаем текущий чат
        setCurrentChat(chat);
    };

    const renderChatItem = (chat) => {
        const lastMessage = lastMessages[chat.chat_id] || chat.last_message;
        const messageText = lastMessage ? (
            chat.is_group ? 
                `${lastMessage.sender_name}: ${lastMessage.content}` :
                lastMessage.content
        ) : 'Нет сообщений';

        return (
            <div 
                className="item" 
                key={chat.chat_id}
                onClick={() => handleChatClick(chat)}
            >
                <img
                    src={chat.displayImage}
                    alt="avatar"
                />
                <div className="texts">
                    <span>{chat.displayName}</span>
                    <p>{messageText}</p>
                </div>
                {lastMessage && (
                    <span className="message-time">
                        {formatDate(lastMessage.date)}
                    </span>
                )}
            </div>
        );
    };

    useEffect(() => {
        const subscription = supabase
            .channel('public:messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async () => {
                // Перезагружаем список чатов
                await fetchChats();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [userId]);

    return (
        <div className="chatList">
            <div className="search">
                <div className="searchBar">
                    <img src="/search.png" alt="search"/>
                    <input
                        type="text"
                        placeholder="Search"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                </div>
                <img 
                    src={addMode ? "../../../../public/minus.png" : "../../../../public/plus.png"} 
                    onClick={() => setAddMode(!addMode)} 
                    alt="add friend" 
                    className="add"
                />
            </div>

            {addMode && <AddUser onClose={() => setAddMode(false)} />}

            <div className="chat-items">
                {filteredChats.length > 0 ? (
                    filteredChats.map((chat) => renderChatItem(chat))
                ) : (
                    <div className="no-chats">Нет доступных чатов</div>
                )}
            </div>
        </div>
    );
}

export default ChatList;