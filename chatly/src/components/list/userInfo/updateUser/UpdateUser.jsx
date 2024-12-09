import "./updateUser.css"
import { useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { getCurrentUser, updateCurrentUserData } from "../../../../lib/auth";
import { toast } from 'react-toastify';

function UpdateUser({ onClose }) {
    const [loading, setLoading] = useState(false);
    const currentUser = getCurrentUser();

    const checkConnection = async () => {
        try {
            const { data, error } = await supabase.from('users').select('count').limit(1);
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Ошибка подключения к Supabase:', err);
            return false;
        }
    };

    const handleEditName = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newUsername = formData.get("username");

        if (!newUsername) {
            toast.warn("Введите имя пользователя");
            return;
        }

        if (newUsername.length > 25) {
            toast.warn("Имя пользователя слишком длинное");
            return;
        }

        try {
            setLoading(true);
            console.log('Начинаем обновление имени пользователя');
            console.log('Текущий пользователь:', currentUser);

            const params = {
                p_user_id: parseInt(currentUser.id),
                p_username: newUsername
            };
            console.log('Параметры запроса:', params);

            const { data, error } = await supabase.rpc('update_user_info', params);

            if (error) {
                console.error('Ошибка обновления:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                throw new Error('Нет данных в ответе');
            }

            const updatedUserData = await updateCurrentUserData(currentUser.id);
            if (!updatedUserData) {
                throw new Error('Не удалось обновить данные пользователя');
            }

            toast.success("Имя пользователя успешно обновлено");
            onClose();
            window.location.reload();
        } catch (err) {
            console.error('Полная ошибка:', err);
            toast.error(err.message || "Ошибка при обновлении имени пользователя");
        } finally {
            setLoading(false);
        }
    };

    const handleEditStatus = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newStatus = formData.get("userstatus");

        if (!newStatus) {
            toast.warn("Введите статус");
            return;
        }

        if (newStatus.length > 25) {
            toast.warn("Статус слишком длинный");
            return;
        }

        try {
            setLoading(true);

            const { data, error } = await supabase.rpc('update_user_info', {
                p_user_id: parseInt(currentUser.id),
                p_status: newStatus
            });

            if (error) throw error;

            if (data && data.length > 0) {
                const updatedUserData = await updateCurrentUserData(currentUser.id);
                if (!updatedUserData) {
                    throw new Error('Не удалось обновить данные пользователя');
                }

                toast.success("Статус успешно обновлен");
                onClose();
                window.location.reload();
            }
        } catch (err) {
            console.error('Ошибка при обновлении:', err);
            toast.error("Ошибка при обновлении статуса");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="updateUser">
            <form className="Name" onSubmit={handleEditName}>
                <input 
                    type="text" 
                    placeholder="Изменить имя пользователя" 
                    name="username"
                    disabled={loading}
                />
                <button type="submit" disabled={loading}>
                    {loading ? "Обновление..." : "Изменить"}
                </button>
            </form>
            <form className="Name" onSubmit={handleEditStatus}>
                <input 
                    type="text" 
                    placeholder="Изменить статус" 
                    name="userstatus"
                    disabled={loading}
                />
                <button type="submit" disabled={loading}>
                    {loading ? "Обновление..." : "Изменить"}
                </button>
            </form>   
        </div>
    );
}

export default UpdateUser;
