import { create } from 'zustand';

export const useChatStore = create((set) => ({
    currentChat: null,
    setCurrentChat: (chat) => set({ currentChat: chat }),
    clearCurrentChat: () => set({ currentChat: null })
})); 