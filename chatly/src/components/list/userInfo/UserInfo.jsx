import "./userInfo.css"
import { getCurrentUser } from '../../../lib/auth'

const Userinfo = () => {
    const currentUser = getCurrentUser(); // Получаем данные пользователя из localStorage

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
                <img src="/edit.png" alt="" />
            </div>
        </div>
    )
}

export default Userinfo