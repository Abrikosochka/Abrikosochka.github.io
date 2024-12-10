import "./userInfo.css"
import { getCurrentUser, clearCurrentUser } from '../../../lib/auth'
import { useState } from 'react';
import UpdateUser from './updateUser/UpdateUser';
import AdminPage from './AdminPage/AdminPage';

const Userinfo = () => {
    const currentUser = getCurrentUser();
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const [isAdminOpen, setIsAdminOpen] = useState(false);

    const handleLogout = () => {
        clearCurrentUser();
        localStorage.clear();
        window.location.reload();
    };

    return (
        <div className='userInfo'>
            <div className="user">
                <img src={currentUser?.avatar || "./avatar.png"} alt="" />
                <div className="text">
                    <h2>{currentUser?.username}</h2>
                    <span>{currentUser?.status}</span>
                </div>
            </div>
            <div className="icons">
                {currentUser?.is_admin && (
                    <img 
                        src="/admin.png" 
                        alt="admin" 
                        onClick={() => setIsAdminOpen(true)}
                        title="Админ панель"
                    />
                )}
                <img 
                    src="/edit.png" 
                    alt="edit" 
                    onClick={() => setIsUpdateOpen(true)}
                    title="Редактировать профиль"
                />
                <img 
                    src="/door.png" 
                    alt="logout" 
                    onClick={handleLogout}
                    title="Выйти"
                />
            </div>

            {isUpdateOpen && (
                <div className="modal-overlay" onClick={() => setIsUpdateOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Редактировать профиль</h3>
                            <button 
                                className="close-button" 
                                onClick={() => setIsUpdateOpen(false)}
                            >
                                ×
                            </button>
                        </div>
                        <UpdateUser onClose={() => setIsUpdateOpen(false)} />
                    </div>
                </div>
            )}

            {isAdminOpen && currentUser?.is_admin && (
                <div className="modal-overlay" onClick={() => setIsAdminOpen(false)}>
                    <div className="modal-content admin-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Админ панель</h3>
                            <button 
                                className="close-button" 
                                onClick={() => setIsAdminOpen(false)}
                            >
                                ×
                            </button>
                        </div>
                        <AdminPage onClose={() => setIsAdminOpen(false)} />
                    </div>
                </div>
            )}
        </div>
    )
}

export default Userinfo