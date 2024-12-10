import "./chatList.css"
import { getCurrentUserId, getCurrentUser, getUserChats, getAllLastMessages } from '../../../lib/auth'
import { useChatStore } from '../../../lib/chatStore';
import { supabase } from "../../../lib/supabaseClient.js";
import AddUser from './addUser/AddUser';
import { useEffect, useState } from "react";

const formatDate = (date) => {
    const d = new Date(date);
    d.setHours(d.getHours() + 3);  // Добавляем 3 часа
    
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    // Если сообщение отправлено сегодня или на этой неделе, показываем только время
    if (days < 7) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Иначе показываем полную дату
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
    const [lastMessages, setLastMessages] = useState(getAllLastMessages());
    const [updateTrigger, setUpdateTrigger] = useState(0);

    // Функция для загрузки чатов
    const fetchChats = async () => {
        try {
            const { data, error } = await supabase.rpc('get_user_chats', {
                user_id_param: parseInt(userId)
            });

            if (error) {
                console.error('Ошибка Supabase:', error);
                return;
            }

            if (data) {
                const validChats = data
                    .filter(chat => chat)
                    .map(chat => {
                        if (chat.is_group) {
                            return {
                                ...chat,
                                displayName: chat.chat_name || `Групповой чат ${chat.chat_id}`,
                                displayImage: chat.chat_picture || "/group-avatar.png",
                                displayStatus: ''
                            };
                        } else {
                            const otherUser = Object.values(chat.members || {})
                                .find(member => member.id !== parseInt(userId));
                            return {
                                ...chat,
                                displayName: otherUser?.username || 'Неизвестный пользователь',
                                displayImage: otherUser?.avatar || "/avatar.png",
                                displayStatus: otherUser?.status || 'Нет статуса'
                            };
                        }
                    });

                setProcessedChats(validChats);
            }
        } catch (error) {
            console.error('Ошибка при получении чатов:', error);
        }
    };

    // Обновляем useEffect для отслеживания изменений в localStorage
    useEffect(() => {
        const handleStorageChange = (e) => {
            // Проверяем, изменились ли последние сообщения
            if (e.key === LAST_MESSAGES_KEY) { // Используем константу из auth.js
                console.log('Обновление последних сообщений из localStorage');
                setLastMessages(getAllLastMessages());
            }
        };

        // Подписываемся на изменения в localStorage
        window.addEventListener('storage', handleStorageChange);

        // Подписываемся на изменения в messages через Supabase
        const channel = supabase
            .channel('chat_updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                () => {
                    // Немедленно обновляем последние сообщения из localStorage
                    const messages = getAllLastMessages();
                    setLastMessages(messages);
                }
            )
            .subscribe();

        // Начальная загрузка последних сообщений
        setLastMessages(getAllLastMessages());

        // Очистка при размонтировании
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            channel.unsubscribe();
        };
    }, []);

    // Добавляем эффект для обновления lastMessages при изменении в том же окне
    useEffect(() => {
        const handleCustomEvent = () => {
            setLastMessages(getAllLastMessages());
        };

        window.addEventListener('lastMessagesUpdated', handleCustomEvent);

        return () => {
            window.removeEventListener('lastMessagesUpdated', handleCustomEvent);
        };
    }, []);

    // Добавляем useEffect для обновления чатов при изменении updateTrigger
    useEffect(() => {
        const chats = getUserChats();
        if (chats && chats.length > 0) {
            setProcessedChats(chats);
        }
        fetchChats();
    }, [userId, updateTrigger]);

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

    // Обновляем renderChatItem для корректного отображения последнего сообщения
    const renderChatItem = (chat) => {
        // Получаем последнее сообщение из localStorage
        const lastMessage = lastMessages[chat.chat_id];
        
        // Если нет сообщения в localStorage, используем сообщение из чата
        const messageToShow = lastMessage || chat.last_message;
        
        const messageText = messageToShow ? (
            chat.is_group ? 
                `${messageToShow.sender_name}: ${messageToShow.content}` :
                messageToShow.content
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
                {messageToShow && (
                    <span className="message-time">
                        {formatDate(messageToShow.date)}
                    </span>
                )}
            </div>
        );
    };

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
                    src={addMode ? "/minus.png" : "/plus.png"} 
                    onClick={() => setAddMode(!addMode)} 
                    alt="add friend" 
                    className="add"
                />
            </div>

            {addMode && <AddUser onClose={() => {
                setAddMode(false);
                fetchChats(); // Обновляем список чатов после закрытия окна добавления
            }} />}

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