import { useState } from 'react'
import Notification from "./components/Notification/Notification.jsx";
import Login from './components/Login/Login'
import { getCurrentUserId } from './lib/auth'
import List from './components/List/List'
import './App.css'

function App() {
    // Используем useState для отслеживания изменений userId
    const [userId, setUserId] = useState(getCurrentUserId());

    // Функция для обновления userId, которую передадим в Login
    const handleLogin = (newUserId) => {
        setUserId(newUserId);
    };

    return (
        <div className="container">
            {userId === null ? (
                <Login onLoginSuccess={handleLogin} />
            ) : (
                <>
                    <List/>
                </>
            )}
            <Notification/>
        </div>
    )
}

export default App