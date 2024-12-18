import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { toast } from 'react-toastify';
import './adminPage.css';
import { getCurrentUser } from '../../../../lib/auth';

function AdminPage({ onClose }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const currentUser = getCurrentUser();

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase.rpc('get_all_users');
            if (error) throw error;
            setUsers(data);
        } catch (err) {
            console.error('Ошибка получения пользователей:', err);
            toast.error('Не удалось загрузить пользователей');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleEdit = (user) => {
        setEditingUser(user);
        setNewEmail(user.email);
        setNewPassword(user.password);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.rpc('admin_update_user', {
                p_user_id: editingUser.id,
                p_email: newEmail || null,
                p_password: newPassword || null
            });

            if (error) throw error;

            toast.success('Пользователь обновлен');
            setEditingUser(null);
            fetchUsers();
        } catch (err) {
            console.error('Ошибка обновления:', err);
            toast.error(err.message);
        }
    };

    const handleDelete = async (userId) => {
        if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) {
            return;
        }

        try {
            const { error } = await supabase.rpc('admin_delete_user', {
                p_user_id: userId
            });

            if (error) throw error;

            toast.success('Пользователь удален');
            fetchUsers();
        } catch (err) {
            console.error('Ошибка удаления:', err);
            toast.error(err.message);
        }
    };

    return (
        <div className="admin-page">
            {loading ? (
                <div className="loading">Загрузка...</div>
            ) : (
                <div className="users-list">
                    {users.map(user => (
                        <div key={user.id} className="user-card">
                            <div className="user-info">
                                <img src={user.avatar || "/avatar.png"} alt="" />
                                <div className="details">
                                    <h3>{user.username}</h3>
                                    <p>{user.email}</p>
                                    <span className="status">{user.status}</span>
                                    {user.id === currentUser.id && (
                                        <span className="current-user-badge">Это вы</span>
                                    )}
                                </div>
                            </div>
                            <div className="actions">
                                <button 
                                    onClick={() => handleEdit(user)}
                                    className="edit-btn"
                                >
                                    Изменить
                                </button>
                                {user.id !== currentUser.id && (
                                    <button 
                                        onClick={() => handleDelete(user.id)}
                                        className="delete-btn"
                                    >
                                        Удалить
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editingUser && (
                <div className="modal-overlay">
                    <div className="edit-modal">
                        <h2>Редактировать пользователя</h2>
                        <form onSubmit={handleUpdate}>
                            <div className="form-group">
                                <label>Email:</label>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Новый пароль:</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                            <div className="modal-buttons">
                                <button type="submit">Сохранить</button>
                                <button 
                                    type="button" 
                                    onClick={() => setEditingUser(null)}
                                >
                                    Отмена
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPage; 