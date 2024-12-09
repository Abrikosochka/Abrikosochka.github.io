import { create } from 'zustand';
import { getCurrentUser } from './auth';

export const useUserStore = create((set) => ({
    currentUser: getCurrentUser(),
    setCurrentUser: (user) => set({ currentUser: user }),
    clearCurrentUser: () => set({ currentUser: null }),
})); 