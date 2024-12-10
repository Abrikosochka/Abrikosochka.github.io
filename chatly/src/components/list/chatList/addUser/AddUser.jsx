import "./addUser.css"
import { useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { getCurrentUserId, addChat } from "../../../../lib/auth";
import { useChatStore } from "../../../../lib/chatStore";

function AddUser({ onClose }) {
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [groupName, setGroupName] = useState("");
    const [error, setError] = useState("");
    const currentUserId = getCurrentUserId();
    const { setCurrentChat } = useChatStore();

    const handleModalClick = (e) => {
        e.stopPropagation(); // Предотвращаем всплытие клика
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        setError("");
        const formData = new FormData(e.target);
        const username = formData.get("username");

        try {
            const { data, error } = await supabase
                .rpc('search_users', { 
                    search_term: username,
                    current_user_id: currentUserId
                });

            if (error) throw error;
            setSearchResults(data || []);
        } catch (err) {
            console.error("Ошибка поиска:", err);
            setError("Ошибка при поиске пользователей");
        }
    };

    const checkPersonalChatExists = async (userId) => {
        try {
            const { data, error } = await supabase
                .rpc('check_personal_chat_exists', {
                    user1_id: currentUserId,
                    user2_id: userId
                });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error("Ошибка проверки существования чата:", err);
            return false;
        }
    };

    const toggleUserSelection = async (user) => {
        setError("");
        
        // Если пользователь уже выбран, просто удаляем его
        if (selectedUsers.some(u => u.id === user.id)) {
            setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
            return;
        }

        setSelectedUsers(prev => [...prev, user]);
    };

    const handleCreateChat = async () => {
        try {
            const isGroup = selectedUsers.length > 1;
            
            if (!isGroup) {
                const chatExists = await checkPersonalChatExists(selectedUsers[0].id);
                if (chatExists) {
                    setError("У вас уже есть личный чат с этим пользователем");
                    return;
                }
            }

            const memberIds = selectedUsers.map(user => user.id);

            const { data: newChat, error } = await supabase
                .rpc('create_chat_with_members', {
                    is_group_chat: isGroup,
                    chat_name: isGroup ? groupName : null,
                    creator_id: currentUserId,
                    member_ids: memberIds
                });

            if (error) throw error;

            const { data: chatData, error: chatError } = await supabase.rpc('get_user_chats', {
                user_id_param: currentUserId
            });

            if (chatError) throw chatError;

            const createdChat = chatData.find(chat => chat.chat_id === newChat.chat_id);
            
            if (createdChat) {
                const processedChat = {
                    ...createdChat,
                    displayName: createdChat.chat_name || 
                        (isGroup ? `Групповой чат ${createdChat.chat_id}` : selectedUsers[0].username),
                    displayImage: createdChat.chat_picture || 
                        (isGroup ? "/group-avatar.png" : selectedUsers[0].avatar || "/avatar.png"),
                    displayStatus: '',
                    is_group: isGroup
                };

                addChat(processedChat);
                setCurrentChat(processedChat);
            }

            setSelectedUsers([]);
            setGroupName("");
            setSearchResults([]);
            onClose();

        } catch (err) {
            console.error("Ошибка создания чата:", err);
            setError("Ошибка при создании чата");
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={handleModalClick}>
                <div className="modal-header">
                    <h3>Создать чат</h3>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                
                <form onSubmit={handleSearch}>
                    <input 
                        type="text" 
                        placeholder="Поиск пользователя" 
                        name="username"
                    />
                    <button type="submit">Поиск</button>
                </form>

                {error && <div className="error-message">{error}</div>}

                {selectedUsers.length > 1 && (
                    <div className="group-name-input">
                        <input
                            type="text"
                            placeholder="Название группы"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />
                    </div>
                )}

                <div className="selected-users">
                    {selectedUsers.map(user => (
                        <div key={user.id} className="selected-user-tag">
                            <img 
                                src={user.avatar || "/avatar.png"} 
                                alt={user.username}
                                className="selected-user-avatar"
                            />
                            <span className="selected-user-name">{user.username}</span>
                            <span 
                                className="remove-user"
                                onClick={() => toggleUserSelection(user)}
                            >
                                ×
                            </span>
                        </div>
                    ))}
                </div>

                <div className="search-results">
                    {searchResults.map(user => (
                        <div key={user.id} className="user">
                            <div className="detail">
                                <img 
                                    src={user.avatar || "/avatar.png"} 
                                    alt={user.username}
                                />
                                <span>{user.username}</span>
                            </div>
                            <button 
                                onClick={() => toggleUserSelection(user)}
                                className={selectedUsers.some(u => u.id === user.id) ? 'selected' : ''}
                            >
                                {selectedUsers.some(u => u.id === user.id) ? 'Выбран' : 'Выбрать'}
                            </button>
                        </div>
                    ))}
                </div>

                {selectedUsers.length > 0 && (
                    <button 
                        className="create-chat-btn"
                        onClick={handleCreateChat}
                        disabled={selectedUsers.length > 1 && !groupName}
                    >
                        {selectedUsers.length > 1 
                            ? 'Создать групповой чат' 
                            : 'Создать чат'}
                    </button>
                )}
            </div>
        </div>
    );
}

export default AddUser;
