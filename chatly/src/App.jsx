import { useState } from 'react'
import Notification from "./components/Notification/Notification.jsx";
import Login from './components/Login/Login'
import { getCurrentUserId } from './lib/auth'
import List from './components/list/List'
import Chat from './components/Chat/chat.jsx'
import { useChatStore } from './lib/chatStore'
import './App.css'

function App() {
    const [userId, setUserId] = useState(getCurrentUserId());
    const { currentChat } = useChatStore();

    const handleLogin = (newUserId) => {
        setUserId(newUserId);
    };

    return (
        <div className="container">
            {userId === null ? (
                <Login onLoginSuccess={handleLogin} />
            ) : (
                <>
                    <List />
                    {currentChat && <Chat />}
                </>
            )}
            <Notification />
        </div>
    )
}

export default App