import { create } from 'zustand';
import { User } from '@/types';
import { onAuthChange, signOut as firebaseSignOut } from '@/lib/firebase/auth';

interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;

    // Actions
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    signOut: () => Promise<void>;
    initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    error: null,

    setUser: (user) => set({ user, loading: false }),

    setLoading: (loading) => set({ loading }),

    setError: (error) => set({ error }),

    signOut: async () => {
        try {
            await firebaseSignOut();
            set({ user: null, error: null });
        } catch (error: any) {
            set({ error: error.message });
        }
    },

    initialize: () => {
        // Listen to auth state changes
        onAuthChange((user) => {
            set({ user, loading: false });
        });
    },
}));
