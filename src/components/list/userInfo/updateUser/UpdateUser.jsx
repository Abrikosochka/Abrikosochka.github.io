import "./updateUser.css"
import { useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { getCurrentUser, updateCurrentUserData } from "../../../../lib/auth";
import { useUserStore } from "../../../../lib/userStore";
import { toast } from 'react-toastify';
import { transliterate } from 'transliteration';

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
        if (file && (file.type === 'image/png' || file.type === 'image/jpg' || file.type === 'image/jpeg')) {
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
        else {
            return toast.warn("Неверный формат изображения");
        }
    };

    const uploadAvatar = async (file) => {
        const fileExt = file.name.split('.').pop();
        const safeUsername = transliterate(currentUser.username).replace(/[^a-zA-Z0-9_-]/g, '');
        console.log(safeUsername);
        const fileName = `${safeUsername}-${Date.now()}.${fileExt}`;
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
        if (!formData.username.trim() && !formData.status.trim() && !formData.avatar.file) {
            toast.warn("Нет изменений для сохранения");
            return;
        }

        // Проверяем имя пользователя
        if (formData.username) {
            if(currentUser.username === formData.username) {
                toast.warn("Имя пользователя не должно совпадать с текущим");
                return;
            }
            if (formData.username.length > 20) {
                toast.warn("Имя пользователя не должно превышать 20 символов");
                return;
            }
            if (!/(?=.*[a-zA-Z])(?=.*[а-яА-Я])|([a-zA-Z].*[a-zA-Z])|([а-яА-Я].*[а-яА-Я])/.test(formData.username)) {
                toast.warn("Имя пользователя должно содержать как минимум 2 символа");
                return;
            }
        }

        // Проверяем статус
        if (formData.status) {
            if (currentUser.status === formData.status) {
                toast.warn("Статус не должен совпадать с текущим");
                return;
            }
            if (formData.status.length > 50) {
                toast.warn("Статус не должен превышать 50 символов");
                return;
            }
        }

        try {
            setLoading(true);

            let avatarUrl = null;
            if (formData.avatar.file) {
                avatarUrl = await uploadAvatar(formData.avatar.file);
            }

            console.log(currentUser);

            const { data, error } = await supabase.rpc('update_user_info', {
                p_user_id: parseInt(currentUser.id),
                p_username: formData.username?.trim() || null,
                p_status: formData.status?.trim() || null,
                p_avatar: avatarUrl || null
            });

            if (error) throw error;

            const updatedUserData = await updateCurrentUserData(currentUser.id);
            if (!updatedUserData) {
                throw new Error('Не удалось обновить данные пользователя');
            }

            setStoreUser(updatedUserData);
            toast.success("Данные успешно обновлены");
            onClose();

        } catch (err) {
            console.error('Ошибка при обновлении:', err);
            if (err.message === "Это имя пользователя уже занято") {
                toast.error("Это имя пользователя уже занято");
            } else {
                toast.error("Произошла ошибка при обновлении данных");
            }
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
