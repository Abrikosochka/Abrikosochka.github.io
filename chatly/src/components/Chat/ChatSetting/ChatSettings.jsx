import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { toast } from 'react-toastify';
import { useChatStore } from '../../../lib/chatStore';
import './chatSettings.css';

function ChatSettings({ chat, currentUser, onClose, onUpdate }) {
    console.log('Chat Data:', {
        chat: chat,
        currentUser: currentUser,
        members: chat.members,
        isGroup: chat.is_group,
        currentUserAdmin: Object.values(chat.members || {}).some(member => 
            member.id === currentUser.id && member.is_admin
        )
    });

    const [loading, setLoading] = useState(false);
    const [chatName, setChatName] = useState(chat.chat_name || '');
    const [chatPicture, setChatPicture] = useState(null);
    const [blockedUsers, setBlockedUsers] = useState(
        chat.members ? 
        Object.values(chat.members).reduce((acc, member) => {
            acc[member.id] = member.blocked_user || false;
            return acc;
        }, {}) : 
        {}
    );
    const { setCurrentChat } = useChatStore();

    // Определяем, является ли текущий пользователь админом
    const isCurrentUserAdmin = chat.is_admin === true;

    const handleBlockUser = async (userId) => {
        try {
            setLoading(true);
            setBlockedUsers(prev => ({
                ...prev,
                [userId]: !prev[userId]
            }));

            const { error } = await supabase.rpc('toggle_user_block', {
                p_chat_id: chat.chat_id,
                p_user_id: userId,
                p_admin_id: currentUser.id
            });

            if (error) {
                setBlockedUsers(prev => ({
                    ...prev,
                    [userId]: !prev[userId]
                }));
                throw error;
            }

            toast.success('Статус пользователя обновлен');

        } catch (err) {
            console.error('Ошибка:', err);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateChat = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('update_group_chat', {
                p_chat_id: chat.chat_id,
                p_admin_id: currentUser.id,
                p_chat_name: chatName || null,
                p_chat_picture: chatPicture || null
            });

            if (error) throw error;

            // Получаем обновленные данные чата
            const { data: chatData, error: chatError } = await supabase.rpc('get_user_chats', {
                user_id_param: currentUser.id
            });

            if (chatError) throw chatError;

            // Находим обновленный чат
            const updatedChat = chatData.find(c => c.chat_id === chat.chat_id);
            if (updatedChat) {
                const processedChat = {
                    ...updatedChat,
                    displayName: updatedChat.chat_name || `Групповой чат ${updatedChat.chat_id}`,
                    displayImage: updatedChat.chat_picture || "/group-avatar.png",
                    displayStatus: '',
                    is_group: updatedChat.is_group,
                    isAdmin: updatedChat.is_admin,
                    members: updatedChat.members
                };

                // Обновляем текущий чат в store
                setCurrentChat(processedChat);

                // Обновляем чаты в localStorage
                const chats = JSON.parse(localStorage.getItem('userChats') || '[]');
                const chatIndex = chats.findIndex(c => c.chat_id === chat.chat_id);
                if (chatIndex !== -1) {
                    chats[chatIndex] = processedChat;
                    localStorage.setItem('userChats', JSON.stringify(chats));
                }

                // Вызываем обновление компонента и показываем уведомление
                onUpdate();
                toast.success('Информация о чате обновлена');
                
                // Закрываем настройки после небольшой задержки
                setTimeout(() => {
                    onClose();
                }, 1000);
            }
        } catch (err) {
            console.error('Ошибка:', err);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-settings-overlay" onClick={onClose}>
            <div className="chat-settings" onClick={e => e.stopPropagation()}>
                <div className="settings-header">
                    <h3>Настройки чата</h3>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                
                {chat.is_group && isCurrentUserAdmin && (
                    <form onSubmit={handleUpdateChat}>
                        <input
                            type="text"
                            placeholder="Название чата"
                            value={chatName}
                            onChange={(e) => setChatName(e.target.value)}
                        />
                        <div className="file-input">
                            <label>
                                <span>Выберите файл</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setChatPicture(e.target.files[0])}
                                />
                            </label>
                            <span className="file-name">
                                {chatPicture ? chatPicture.name : 'Файл не выбран'}
                            </span>
                        </div>
                        <button type="submit" disabled={loading}>
                            {loading ? 'Обновление...' : 'Обновить'}
                        </button>
                    </form>
                )}

                <div className="members-list">
                    {chat.members && Object.values(chat.members).map(member => {
                        const isBlocked = blockedUsers[member.id] || false;
                        const canBlock = (
                            (chat.is_group && isCurrentUserAdmin && !member.is_admin) || 
                            !chat.is_group
                        ) && member.id !== currentUser.id;
                        
                        return (
                            <div key={member.id} className="member-item">
                                <img src={member.avatar || "/avatar.png"} alt="" />
                                <span>{member.username}</span>
                                {canBlock && (
                                    <button
                                        onClick={() => handleBlockUser(member.id)}
                                        disabled={loading}
                                        className={isBlocked ? 'blocked' : ''}
                                    >
                                        {isBlocked ? 'Разблокировать' : 'Заблокировать'}
                                    </button>
                                )}
                                {chat.is_group && member.is_admin && (
                                    <span className="admin-badge">Админ</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default ChatSettings;