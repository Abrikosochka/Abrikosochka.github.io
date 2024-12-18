import "./updateUser.css"
import { useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { getCurrentUser, updateCurrentUserData } from "../../../../lib/auth";
import { useUserStore } from "../../../../lib/userStore";
import { toast } from 'react-toastify';

function UpdateUser({ onClose }) {
    const [loading, setLoading] = useState(false);
    const currentUser = getCurrentUser();
    const { setCurrentUser: setStoreUser } = useUserStore();
    const [formData, setFormData] = useState({
        username: '',
        status: '',
        avatar: {
            file: null,
            url: ""
        }
    });

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log('File selected:', {
                name: file.name,
                type: file.type,
                size: file.size
            });

            setFormData(prev => ({
                ...prev,
                avatar: {
                    file: file,
                    url: URL.createObjectURL(file)
                }
            }));
        }
    };

    const uploadAvatar = async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.username}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('Avatar upload failed:', error);
            throw new Error("Не удалось загрузить аватар");
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        
        // Проверяем, есть ли какие-либо изменения
        if (!formData.username && !formData.status && !formData.avatar.file) {
            toast.warn("Нет изменений для сохранения");
            return;
        }

        try {
            setLoading(true);

            let avatarUrl = null;
            if (formData.avatar.file) {
                avatarUrl = await uploadAvatar(formData.avatar.file);
            }

            const { data, error } = await supabase.rpc('update_user_info', {
                p_user_id: parseInt(currentUser.id),
                p_username: formData.username || null,
                p_status: formData.status || null,
                p_avatar: avatarUrl || null
            });

            if (error) throw error;

            const updatedUserData = await updateCurrentUserData(currentUser.id);
            if (!updatedUserData) {
                throw new Error('Не удалось обновить данные пользователя');
            }

            // Обновляем данные в store
            setStoreUser(updatedUserData);

            toast.success("Данные успешно обновлены");
            onClose();

        } catch (err) {
            console.error('Ошибка при обновлении:', err);
            toast.error(err.message || "Ошибка при обновлении данных");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="updateUser">
            <form onSubmit={handleUpdate}>
                <div className="avatar-upload">
                    <label htmlFor="avatar">
                        <img 
                            src={formData.avatar.url || currentUser.avatar || "/avatar.png"} 
                            alt="avatar" 
                        />
                        <span>Изменить аватар</span>
                    </label>
                    <input
                        type="file"
                        id="avatar"
                        onChange={handleAvatarChange}
                        accept="image/*"
                        style={{ display: "none" }}
                    />
                </div>

                <input 
                    type="text" 
                    placeholder="Изменить имя пользователя" 
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    disabled={loading}
                />

                <input 
                    type="text" 
                    placeholder="Изменить статус" 
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    disabled={loading}
                />

                <button type="submit" disabled={loading}>
                    {loading ? "Обновление..." : "Сохранить изменения"}
                </button>
            </form>
        </div>
    );
}

export default UpdateUser;
