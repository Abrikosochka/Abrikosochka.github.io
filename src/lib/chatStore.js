import {create} from 'zustand';

export const useChatStore = create((set) => ({
    currentChat: null,
    setCurrentChat: (chat) => {
        if (chat === null) {
            set({ currentChat: null });
        } else if (typeof chat === 'object') {
            set({ currentChat: { ...chat } });
        } else {
            console.error('Некорректные данные чата:', chat);
        }
    },
    clearCurrentChat: () => set({ currentChat: null }),
})); 