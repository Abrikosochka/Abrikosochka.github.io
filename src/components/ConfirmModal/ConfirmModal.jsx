import React from 'react';
import './confirmModal.css';

function ConfirmModal({ message, onConfirm, onCancel }) {
    return (
        <div className="confirm-modal-overlay">
            <div className="confirm-modal">
                <h3>Подтверждение действия</h3>
                <p className="confirm-message">{message}</p>
                <div className="confirm-modal-buttons">
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
                        Подтвердить
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmModal; 