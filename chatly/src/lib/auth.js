import { supabase } from './supabaseClient';

const USER_KEY = 'userId';
const USER_DATA_KEY = 'userData';
const CHATS_KEY = 'userChats';
const MESSAGES_KEY = 'chatMessages';
const LAST_MESSAGES_KEY = 'lastMessages';

let currentUserId = localStorage.getItem(USER_KEY);
let currentUserData = JSON.parse(localStorage.getItem(USER_DATA_KEY));
let currentChats = JSON.parse(localStorage.getItem(CHATS_KEY) || '[]');

// Сохранение id и данных пользователя
export function setCurrentUser(userId, userData) {
     currentUserId = userId;
     currentUserData = userData;
     localStorage.setItem(USER_KEY, userId);
     localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
}

// Получение id пользователя
export function getCurrentUserId() {
     return currentUserId;
}

// Получение данных пользователя
export function getCurrentUser() {
     return currentUserData;
}

// Очистка данных при выходе
export function clearCurrentUser() {
     currentUserId = null;
     currentUserData = null;
     localStorage.removeItem(USER_KEY);
     localStorage.removeItem(USER_DATA_KEY);
}

export function isAuthenticated() {
     return currentUserId !== null;
}

// Сохранение чатов
export function setUserChats(chats) {
     currentChats = chats;
     localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
}

// Добавление нового чата
export function addChat(chat) {
     currentChats = [chat, ...currentChats];
     localStorage.setItem(CHATS_KEY, JSON.stringify(currentChats));
}

//Получение данных пользователей в чате
export function getUserChats() {
     return currentChats;
}

// Получение сообщений для конкретного чата
export function getChatMessages(chatId) {
    try {
        const messages = localStorage.getItem(`chat_messages_${chatId}`);
        return messages ? JSON.parse(messages) : [];
    } catch (error) {
        console.error('Ошибка при получении сообщений:', error);
        return [];
    }
}

// Сохранение сообщений чата
export function setChatMessages(chatId, messages) {
    try {
        localStorage.setItem(`chat_messages_${chatId}`, JSON.stringify(messages));
    } catch (error) {
        console.error('Ошибка при сохранении сообщений:', error);
    }
}

// Добавление нового сообщения
export function addMessage(chatId, message) {
    try {
        const messages = getChatMessages(chatId);
        // Проверяем, нет ли уже такого сообщения
        const messageExists = messages.some(m => m.message_id === message.message_id);
        
        if (!messageExists) {
            // Добавляем новое сообщение в конец массива
            const updatedMessages = [...messages, message];
            // Сортируем по дате
            updatedMessages.sort((a, b) => new Date(a.date) - new Date(b.date));
            // Сохраняем обновленный список
            setChatMessages(chatId, updatedMessages);
            return updatedMessages;
        }
        
        return messages;
    } catch (error) {
        console.error('Ошибка при добавлении сообщения:', error);
        return [];
    }
}

// Получение последнего сообщения для чата
export function getLastMessage(chatId) {
    const lastMessages = JSON.parse(localStorage.getItem(LAST_MESSAGES_KEY) || '{}');
    return lastMessages[chatId];
}

// Сохранение последнего сообщения
export function setLastMessage(chatId, message) {
    const lastMessages = JSON.parse(localStorage.getItem(LAST_MESSAGES_KEY) || '{}');
    lastMessages[chatId] = message;
    localStorage.setItem(LAST_MESSAGES_KEY, JSON.stringify(lastMessages));
    
    // Создаем и диспатчим событие для оповещения об изменениях
    const event = new Event('lastMessagesUpdated');
    window.dispatchEvent(event);

    // Также диспатчим событие storage для других вкладок
    const storageEvent = new StorageEvent('storage', {
        key: LAST_MESSAGES_KEY,
        newValue: JSON.stringify(lastMessages),
        url: window.location.href
    });
    window.dispatchEvent(storageEvent);
}

// Получение всех последних сообщений
export function getAllLastMessages() {
    return JSON.parse(localStorage.getItem(LAST_MESSAGES_KEY) || '{}');
}

// Добавим новую функцию для обновления данных пользователя
export const updateCurrentUserData = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        if (data) {
            // Обновляем также currentUserData в памяти
            currentUserData = data;
            localStorage.setItem(USER_DATA_KEY, JSON.stringify(data));
            return data;
        }
        return null;
    } catch (err) {
        console.error('Ошибка при обновлении данных пользователя:', err);
        return null;
    }
};