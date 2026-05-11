import { create } from 'zustand';

const useToastStore = create((set, get) => ({
  toasts: [],

  // Add a new toast
  addToast: (message, type = 'success', duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast = { id, message, type, duration };

    set((state) => ({
      toasts: [...state.toasts, toast]
    }));

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  // Remove a toast by id
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  },

  // Convenience methods
  success: (message, duration) => get().addToast(message, 'success', duration),
  error: (message, duration) => get().addToast(message, 'error', duration),
  info: (message, duration) => get().addToast(message, 'info', duration),
  warning: (message, duration) => get().addToast(message, 'warning', duration),
}));

export { useToastStore };
export default useToastStore;