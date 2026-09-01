import { create } from 'zustand';
import apiClient from '../utils/api';

export const useAuthStore = create((set) => ({
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null,
  token: localStorage.getItem('token') || null,
  loading: false,
  error: null,

  // Admin login
  adminLogin: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post('/auth/admin/login', { email, password });
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      set({ user, token, loading: false });
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Login failed';
      set({ error: errorMessage, loading: false });
      return false;
    }
  },

  // Student login using credentials assigned by admin
  studentLogin: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post('/auth/student/login', { email, password });
      const { token, user, firstTime } = response.data;
      const storedUser = { ...user, grade_id: user?.grade_id ?? null, firstTime: Boolean(firstTime) };

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(storedUser));
      localStorage.setItem('firstTime', String(Boolean(firstTime)));

      set({ user: storedUser, token, loading: false });
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Student login failed';
      set({ error: errorMessage, loading: false });
      return false;
    }
  },

  // Complete student profile
  completeProfile: async (gradeId, subjects) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post('/auth/complete-profile', { gradeId, subjects });
      const { token } = response.data;
      const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
      const updatedUser = { ...(currentUser || {}), grade_id: gradeId, firstTime: false };

      localStorage.setItem('token', token || localStorage.getItem('token'));
      localStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.removeItem('firstTime');

      set((state) => ({ user: { ...(state.user || {}), ...updatedUser }, loading: false }));
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Profile completion failed';
      set({ error: errorMessage, loading: false });
      return false;
    }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const response = await apiClient.get('/auth/me');
      const user = response.data.user;

      localStorage.setItem('user', JSON.stringify(user));
      set({ user });
      return user;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  // Logout
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('firstTime');
      set({ user: null, token: null, error: null });
    }
  },

  // Set error
  setError: (error) => set({ error }),

  // Clear error
  clearError: () => set({ error: null }),
}));
