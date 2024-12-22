import React from 'react';
import './deleteConfirmModal.css';

function DeleteConfirmModal({ onConfirm, onCancel, chatName }) {
    return (
        <div className="delete-modal-overlay">
            <div className="delete-modal">
                <h3>Подтверждение удаления чата</h3>
                <p className="chat-name">{chatName}</p>
                <div className="delete-modal-buttons">
                    <button 
                        className="cancel-button" 
                        onClick={onCancel}
                    >
                        Отмена
                    </button>
                    <button 
                        className="confirm-button" 
                        onClick={onConfirm}
                    >
                        Удалить
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DeleteConfirmModal; 