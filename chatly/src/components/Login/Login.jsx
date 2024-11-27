import { useState } from "react";
import { setCurrentUser} from '../../lib/auth.js';
import "./login.css";
import { supabase } from "../../lib/supabaseClient.js";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import PropTypes from 'prop-types';

function Login({ onLoginSuccess }) {

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

            if (!email || !password)
                return toast.warn("Please enter all fields!");

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email)) {
                return toast.warn("Please enter a valid email address");
            }

            const { data: userId, error } = await supabase.rpc('check_user_credentials', {
                p_email: email,
                p_password: password
            });

            if (error) console.error(error);


            if (userId > 0) {
                // Теперь получаем данные
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id, username, email, avatar, status, is_admin')
                    .eq('id', userId);

                if (userError) console.error(userError);

                const user = userData[0]; // Берем первого пользователя

                // Сохраняем данные
                setCurrentUser(userId, user);
                onLoginSuccess(userId);
                toast.success('Welcome!');
            } else {
                switch (userId) {
                    case -1:
                        toast.error("There is no user with this Email address");
                        break;
                    case -2:
                        toast.error('Incorrect password');
                        break;
                    default:
                        toast.error('Unknown error occurred');
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

            if (!username || !email || !password) {
                return toast.warn("Please enter all fields!");
            }

            if (!avatar.file) {
                return toast.warn("Please upload an avatar!");
            }

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
                    toast.success("Account created! You can login now!");
                    break;
                case -1:
                    toast.error('Username already taken');
                    break;
                case -2:
                    toast.error('Email is already in use');
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