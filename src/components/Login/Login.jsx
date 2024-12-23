import { useState } from "react";
import { setCurrentUser } from '../../lib/auth.js';
import { useUserStore } from '../../lib/userStore';
import "./login.css";
import { supabase } from "../../lib/supabaseClient.js";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import PropTypes from 'prop-types';

function Login({ onLoginSuccess }) {

    const { setCurrentUser: setStoreUser } = useUserStore();

    const [avatar, setAvatar] = useState({
        file: null,
        url: ""
    });

    const [loading, setLoading] = useState(false);

    const handleAvatar = (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log('File selected:', {
                name: file.name,
                type: file.type,
                size: file.size
            });

            setAvatar({
                file: file,
                url: URL.createObjectURL(file)
            });
        }
    };

    const handleLogin = async (e) =>{
        e.preventDefault()

        try{
            setLoading(true)

            const formData = new FormData(e.target)
            const {email, password} = Object.fromEntries(formData);

            if (!email.trim() || !password.trim())
                return toast.warn("Пожалуйста, заполните все поля!");

            if (password.length < 6) {
                return toast.warn("Пароль должен содержать минимум 6 символов");
            }

            if (password.length > 20) {
                return toast.warn("Пароль не должен превышать 20 символов");
            }

            const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailPattern.test(email)) {
                return toast.warn("Пожалуйста, введите корректный email адрес");
            }

            const { data, error } = await supabase.rpc('check_user_credentials', {
                p_email: email,
                p_password: password
            });

            if (error) console.error(error);

            if(data){
                if (data[0].id == -1) {
                    toast.error("Такого пользователя не существует");
                    return;
                } else if(data[0].id == -2){
                    toast.error('Неправильный пароль');
                    return;
                } else {
                    setCurrentUser(data[0].id, data[0]);
                    setStoreUser(data[0]);
                    onLoginSuccess(data[0].id);
                    toast.success('Добро пожаловать!');
                }
            }

        }catch(err){
            console.log(err)
            toast.error(err.message)
        }finally{
            setLoading(false)
        }
    }


    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData(e.target);
            const { username, email, password } = Object.fromEntries(formData);

            if (!username?.trim() || !email?.trim() || !password?.trim()) {
                return toast.warn("Поля не могут быть пустыми или содержать только пробелы");
            }

            if (username.length > 20) {
                return toast.warn("Имя пользователя не должно превышать 20 символов");
            }

            if (!/(?=.*[a-zA-Z])(?=.*[а-яА-Я])|([a-zA-Z].*[a-zA-Z])|([а-яА-Я].*[а-яА-Я])/.test(username)) {
                return toast.warn("Имя пользователя должно содержать как минимум 2 символа");
            }

            if (password.length < 6) {
                return toast.warn("Пароль должен содержать минимум 6 символов");
            }

            if (password.length > 20) {
                return toast.warn("Пароль не должен превышать 20 символов");
            }

            const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailPattern.test(email)) {
                return toast.warn("Please enter a valid email address");
            }

            let avatarUrl = null;

            if (avatar.file) {
                const fileExt = avatar.file.name.split('.').pop();
                const fileName = `${username}-${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                try {
                    const { error: uploadError } = await supabase.storage
                        .from('avatars')
                        .upload(filePath, avatar.file);

                    if (uploadError) {
                        console.error('Upload error:', uploadError);
                    }

                    const { data: { publicUrl } } = supabase.storage
                        .from('avatars')
                        .getPublicUrl(filePath);

                    avatarUrl = publicUrl;
                } catch (uploadError) {
                    console.error('Upload attempt failed:', uploadError);
                }
            }

            const { data, error } = await supabase.rpc('register_user', {
                p_username: username,
                p_password: password,
                p_email: email,
                p_avatar: avatarUrl
            });

            if (error) console.error(error);

            switch (data) {
                case 1:
                    e.target.reset();
                    setAvatar({
                        file: null,
                        url: ""
                    });
                    toast.success("Аккаунт создан! Вы можете войти в систему");
                    break;
                case -1:
                    toast.error('Такое имя пользователя уже занято');
                    break;
                case -2:
                    toast.error('Такой email уже занят');
                    break;
                default:
                    toast.error('Unknown error occurred');
            }

        } catch (error) {
            console.error('Error:', error);
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login">
            <div className="item">
                <h2>Welcome back</h2>
                <form onSubmit={handleLogin}>
                    <input type="text" placeholder="Email" name="email" />
                    <input type="password" placeholder="Password" name="password" />
                    <button disabled={loading}>{loading ? "Loading" : "Sign In"}</button>
                </form>
            </div>
            <div className="separator"></div>
            <div className="item">
                <h2>Create an Account</h2>
                <form onSubmit={handleRegister}>
                    <label htmlFor="file">
                        <img src={avatar.url || "../../../public/avatar.png"} alt="" />
                        Upload an image
                    </label>
                    <input
                        type="file"
                        id="file"
                        style={{display: "none"}}
                        onChange={handleAvatar}
                        accept="image/*"
                    />
                    <input type="text" placeholder="Username" name="username" />
                    <input type="text" placeholder="Email" name="email" />
                    <input type="password" placeholder="Password" name="password" />
                    <button disabled={loading}>
                        {loading ? "Loading..." : "Sign Up"}
                    </button>
                </form>
            </div>
        </div>
    );
}

Login.propTypes = {
    onLoginSuccess: PropTypes.func.isRequired
};

export default Login;