import "./chatList.css"
import { getCurrentUserId, getCurrentUser } from '../../../lib/auth'
import { setUserChats } from "../../../lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient.js";

function ChatList() {
    const userId = getCurrentUserId();
    const currentUser = getCurrentUser();
    const [chats, setChats] = useState([]);
    const [addMode, setAddMode] = useState(false);
    const [inputText, setInputText] = useState("");

    useEffect(() => {
        const getChats = async () => {
            if (!userId) {
                console.error('userId отсутствует');
                return;
            }

            const { data, error } = await supabase.rpc('get_user_chats', {
                user_id_param: parseInt(userId)
            });

            console.log('Ответ от Supabase:', { data, error });

            if (error) {
                console.error('Error:', error);
                return;
            }

            // Убедимся, что у нас есть массив и все элементы валидны
            const validChats = Array.isArray(data) ? data.filter(chat => chat !== null) : [];
            console.log('Валидные чаты:', validChats);

            setChats(validChats);
            setUserChats(validChats);
        };

        getChats();
    }, [userId]);

    // Безопасная фильтрация чатов
    const filteredChats = chats.filter(chat => {
        console.log('фильтр чата:', chat); // Отладка
        console.log('фильтр чата:', chat.is_group); // Отладка

        if (!chat) return false;

        try {
            if (chat.is_group) {
                return chat.chat_name && chat.chat_name.toLowerCase().includes(inputText.toLowerCase());
            } else {
                const members = chat.members || {};
                const otherUsers = Object.values(members);
                return otherUsers.some(user =>
                    user && user.username && user.username.toLowerCase().includes(inputText.toLowerCase())
                );
            }
        } catch (error) {
            console.error('Ошибка при фильтрации чата:', error, chat);
            return false;
        }
    });

    const renderChatItem = (chat) => {
        console.log('Начало рендеринга чата:', chat);

        if (!chat) {
            console.log('Чат пустой');
            return null;
        }

        const members = chat.members || {};
        console.log('Участники чата:', members);

        // Для личного чата
        if (!chat.is_group) {
            const otherUser = Object.values(members)[0] || {};
            console.log('Данные другого пользователя:', otherUser);

            return (
                <div className="item" key={chat.chat_id}>
                    <img
                        src={currentUser?.blocked?.includes(otherUser.id)
                            ? "/avatar.png"
                            : otherUser.avatar || "/avatar.png"
                        }
                        alt="avatar"
                    />
                    <div className="texts">
                        <span>
                            {currentUser?.blocked?.includes(otherUser.id)
                                ? "User"
                                : otherUser.username || 'Неизвестный пользователь'
                            }
                        </span>
                        <p>{otherUser.status || 'Нет статуса'}</p>
                    </div>
                </div>
            );
        }

        // Для группового чата
        const memberCount = Object.keys(members).length + 1;
        return (
            <div className="item" key={chat.chat_id}>
                <img
                    src={chat.chat_picture || "/group-avatar.png"}
                    alt="chat avatar"
                />
                <div className="texts">
                    <span>{chat.chat_name || 'Без названия'}</span>
                    <p>{memberCount} участников</p>
                </div>
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

            <div className="chat-items">
                {filteredChats.length > 0 ? (
                    filteredChats.map((chat, index) => {
                        console.log(`Рендеринг чата ${index}:`, chat);
                        return renderChatItem(chat);
                    })
                ) : (
                    <div className="no-chats">Нет доступных чатов</div>
                )}
            </div>
        </div>
    );
}

export default ChatList;