import { create } from 'zustand';

export const useChatStore = create((set) => ({
    currentChat: null,
    setCurrentChat: (chat) => {
        console.log('Setting current chat:', chat);
        set({ currentChat: chat });
    },
    clearCurrentChat: () => set({ currentChat: null }),
})); 