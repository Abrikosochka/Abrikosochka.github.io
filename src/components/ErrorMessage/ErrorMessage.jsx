import { useEffect, useState } from 'react';
import './errorMessage.css';

function ErrorMessage({ message, onClose }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Ждем окончания анимации
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`error-message ${isVisible ? 'visible' : ''}`}>
            <div className="error-content">
                <span className="error-icon">⚠️</span>
                <p>{message}</p>
            </div>
        </div>
    );
}

export default ErrorMessage; 