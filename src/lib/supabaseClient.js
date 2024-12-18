import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    },
    db: {
        schema: 'public'
    }
})

// Проверяем подключение
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        console.log('Успешное подключение к Supabase');
    } else if (event === 'SIGNED_OUT') {
        console.log('Отключение от Supabase');
    }
});

// Добавляем функцию проверки подключения
export const checkSupabaseConnection = async () => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('count')
            .limit(1);
            
        if (error) throw error;
        console.log('Подключение к Supabase работает');
        return true;
    } catch (error) {
        console.error('Ошибка подключения к Supabase:', error);
        return false;
    }
};