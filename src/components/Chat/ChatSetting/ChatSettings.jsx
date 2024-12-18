import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { toast } from 'react-toastify';
import { useChatStore } from '../../../lib/chatStore';
import './chatSettings.css';
import { setUserChats, getUserChats } from '../../../lib/auth';

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
    const [blockedUsers, setBlockedUsers] = useState(
        chat.members ? 
        Object.values(chat.members).reduce((acc, member) => {
            acc[member.id] = member.blocked_user || false;
            return acc;
        }, {}) : 
        {}
    );
    const { setCurrentChat } = useChatStore();
    const [chatPicture, setChatPicture] = useState({
        file: null,
        url: ""
    });

    const handleChatPicture = (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log('File selected:', {
                name: file.name,
                type: file.type,
                size: file.size
            });
    
            setChatPicture({
                file: file,
                url: URL.createObjectURL(file)
            });
        }
    };

    const uploadChatPicture = async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `chat-${chat.chat_id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
    
        try {
            const { error: uploadError } = await supabase.storage
                .from('chat_pictures') // Bucket name
                .upload(filePath, file);
    
            if (uploadError) throw uploadError;
    
            const { data: { publicUrl } } = supabase.storage
                .from('chat_pictures')
                .getPublicUrl(filePath);
    
            return publicUrl; // Возвращаем публичный URL загруженного изображения
        } catch (error) {
            console.error('Image upload failed:', error);
            toast.error("Не удалось загрузить изображение");
            return null;
        }
    };

    

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

            // Получаем обновленные данные чата
            const { data: chatData } = await supabase.rpc('get_user_chats', {
                user_id_param: currentUser.id
            });

            if (chatData) {
                const updatedChat = chatData.find(c => c.chat_id === chat.chat_id);
                if (updatedChat) {
                    // Обновляем только members в текущем чате
                    const updatedCurrentChat = {
                        ...chat,
                        members: updatedChat.members
                    };

                    // Обновляем чаты в localStorage, сохраняя остальные поля неизменными
                    const currentChats = getUserChats();
                    const updatedChats = currentChats.map(c => 
                        c.chat_id === chat.chat_id ? 
                        {
                            ...c,
                            members: updatedChat.members
                        } : 
                        c
                    );
                    
                    setUserChats(updatedChats);
                    setCurrentChat(updatedCurrentChat);
                }

                window.dispatchEvent(new Event('chatsUpdated'));
                toast.success('Статус пользователя обновлен');
                onUpdate();
            }

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

            let imageUrl = chat.chat_picture; // Текущее изображение чата

            // Если пользователь загрузил новое изображение, загружаем его в Supabase
            if (chatPicture.file) {
                const uploadedUrl = await uploadChatPicture(chatPicture.file);
                if (uploadedUrl) {
                    imageUrl = uploadedUrl; // Обновляем URL изображения
                } else {
                    throw new Error("Failed to upload image");
                }
            }

            console.log(imageUrl);

            const { data, error } = await supabase.rpc('update_group_chat', {
                p_chat_id: chat.chat_id,
                p_admin_id: currentUser.id,
                p_chat_name: chatName || null,
                p_chat_picture: imageUrl || null
            });

            if (error) throw error;

            // Получаем обновленные данные чата
            const { data: chatData, error: chatError } = await supabase.rpc('get_user_chats', {
                user_id_param: currentUser.id
            });

            if (chatError) throw chatError;

            if (chatData) {
                // Обновляем все чаты в localStorage
                const currentChats = getUserChats();
                const updatedChats = currentChats.map(c => {
                    if (c.chat_id === chat.chat_id) {
                        const updatedChat = chatData.find(newChat => newChat.chat_id === chat.chat_id);
                        return {
                            ...updatedChat,
                            displayName: updatedChat.chat_name || `Групповой чат ${updatedChat.chat_id}`,
                            displayImage: updatedChat.chat_picture || "/group-avatar.png",
                            displayStatus: '',
                            is_group: updatedChat.is_group,
                            isAdmin: updatedChat.is_admin,
                            members: updatedChat.members
                        };
                    }
                    return c;
                });

                // Обновляем localStorage
                setUserChats(updatedChats);

                // Обновляем текущий чат в store
                const updatedChat = chatData.find(c => c.chat_id === chat.chat_id);
                if (updatedChat) {
                    setCurrentChat({
                        ...updatedChat,
                        displayName: updatedChat.chat_name || `Групповой чат ${updatedChat.chat_id}`,
                        displayImage: updatedChat.chat_picture || "/group-avatar.png",
                        displayStatus: '',
                        is_group: updatedChat.is_group,
                        isAdmin: updatedChat.is_admin,
                        members: updatedChat.members
                    });
                }

                // Генерируем пользовательское событие для обновления ChatList
                window.dispatchEvent(new Event('chatsUpdated'));

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
                                    onChange={handleChatPicture}
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