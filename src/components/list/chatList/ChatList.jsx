import "./chatList.css"
import { LAST_MESSAGES_KEY, getCurrentUserId, getCurrentUser, getUserChats, getAllLastMessages } from '../../../lib/auth'
import { useChatStore } from '../../../lib/chatStore';
import { supabase } from "../../../lib/supabaseClient.js";
import AddUser from './addUser/AddUser';
import { useEffect, useState } from "react";
import { useUserStore } from '../../../lib/userStore';

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
            if (e.key === LAST_MESSAGES_KEY) {
                console.log('Обновление последних сообщений из localStorage');
                setLastMessages(getAllLastMessages());
            }
        };

        // Подписываемся на изменения в localStorage
        window.addEventListener('storage', handleStorageChange);

        // Подписываемся на изменения в messages через Supabase
        const channelMessages = supabase
            .channel('chat_updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    console.log('Новое сообщение добавлено:', payload); // Для отладки
                    const lastMessages = getAllLastMessages();
                    const chatId = payload.new.chat_id; // Получаем ID чата из payload
                    const newMessage = {
                        content: payload.new.content,
                        sender_name: payload.new.sender_name,
                        date: payload.new.date
                    };

                    // Обновляем состояние lastMessages
                    lastMessages[chatId] = newMessage; // Обновляем последнее сообщение для соответствующего чата
                    setLastMessages(lastMessages); // Устанавливаем обновленные последние сообщения

                    // Обновляем состояние processedChats
                    setProcessedChats(prevChats => {
                        return prevChats.map(chat => {
                            if (chat.chat_id === chatId) {
                                return { ...chat, last_message: newMessage }; // Обновляем последнее сообщение для соответствующего чата
                            }
                            return chat;
                        });
                    });
                }
            )
            .subscribe();

            const channelUsers = supabase
        .channel('user_updates')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE', // Подписка на обновления
                schema: 'public',
                table: 'users'
            },
            (payload) => {
                console.log('Пользователь был обновлен:', payload); // Для отладки
                const updatedUserId = payload.new.id; // Получаем ID обновленного пользователя
                const updatedUserData = payload.new; // Получаем новые данные пользователя

                // Обновляем состояние пользователей
                setUsers(prevUsers => {
                    return prevUsers.map(user => {
                        if (user.id === updatedUserId) {
                            return { ...user, ...updatedUserData }; // Обновляем данные пользователя
                        }
                        return user;
                    });
                });
            }
        )
        .subscribe();

        // Подписываемся на изменения в таблице Chats
        const channelChats = supabase
            .channel('chat_updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chats'
                },
                () => {
                    console.log('Чат был создан или обновлен');
                    fetchChats(); // Обновляем список чатов при изменении
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chats'
                },
                (payload) => {
                    console.log('Чат был обновлен:', payload);
                    const updatedChatId = payload.new.id;
                    const updatedChatName = payload.new.chat_name;

                    setProcessedChats(prevChats => {
                        return prevChats.map(chat => {
                            if (chat.chat_id === updatedChatId) {
                                return { ...chat, displayName: updatedChatName };
                            }
                            return chat;
                        });
                    });

                    fetchChats();
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'chat_members' },
                (payload) => {
                    console.log('Чат был удален:', payload);
                    const deletedChatId = payload.old.id;
    
                    // Удаляем чат из состояния
                    setProcessedChats(prevChats =>
                        prevChats.filter(chat => chat.chat_id !== deletedChatId)
                    );

                    fetchChats();
                }
            )
            .subscribe();

        // Начальная загрузка последних сообщений
        setLastMessages(getAllLastMessages());

        // Очистка при размонтировании
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            channelMessages.unsubscribe(); // Отписка от канала сообщений
            channelChats.unsubscribe(); // Отписка от канала чатов
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

    const handleChatClick = async (chat) => {
        console.log('=== Handle Chat Click ===');
        console.log('Initial chat:', chat);
        
        if (!chat || !chat.chat_id) {
            console.error('Invalid chat data:', chat);
            return;
        }

        try {
            console.log('User ID:', userId);
            const { data, error } = await supabase.rpc('get_user_chats', {
                user_id_param: parseInt(userId)
            });

            if (error) throw error;

            console.log('Received chat data:', data);

            const updatedChat = data.find(c => c.chat_id === chat.chat_id);
            if (updatedChat) {
                const members = {};
                if (updatedChat.members) {
                    Object.entries(updatedChat.members).forEach(([key, value]) => {
                        members[key.toString()] = value;
                    });
                }
                
                console.log('Processed members:', members);
                
                const formattedChat = {
                    ...updatedChat,
                    members,
                    displayName: updatedChat.is_group 
                        ? (updatedChat.chat_name || `Групповой чат ${updatedChat.chat_id}`)
                        : (Object.values(members)
                            .find(member => member.id.toString() !== userId.toString())?.username || 'Неизвестный пользователь'),
                    displayImage: updatedChat.is_group 
                        ? (updatedChat.chat_picture || "/group-avatar.png")
                        : (Object.values(members)
                            .find(member => member.id.toString() !== userId.toString())?.avatar || "/avatar.png"),
                    displayStatus: updatedChat.is_group 
                        ? ''
                        : (Object.values(members)
                            .find(member => member.id.toString() !== userId.toString())?.status || 'Нет статуса')
                };
                
                console.log('Final formatted chat:', formattedChat);
                setCurrentChat(formattedChat);
            }
        } catch (error) {
            console.error('Error in handleChatClick:', error);
        }
    };

    const handleDeleteChat = async (chatId) => {
        console.log(userId);
        try {
            const { error } = await supabase.rpc('delete_user_from_chat', {
                p_chat_id: chatId,
                p_user_id: userId
            });
    
            if (error) {
                console.error('Ошибка при удалении пользователя из чата:', error.message);
                alert('Не удалось удалить пользователя из чата');
            } else {
                console.log('Пользователь успешно удален из чата');
            }
        } catch (error) {
            console.error('Ошибка при вызове функции удаления пользователя из чата:', error);
        }
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

                {/* Кнопка удаления чата */}
                <button
                    className="delete-button"
                    onClick={() => handleDeleteChat(chat.chat_id)}
                    title="Удалить чат"
                    style={{ marginLeft: "10px", cursor: "pointer", color: "#973880" }}
                >
                    ✖
                </button>
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