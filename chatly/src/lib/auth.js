const USER_KEY = 'userId';
const USER_DATA_KEY = 'userData';
const CHATS_KEY = 'userChats';

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