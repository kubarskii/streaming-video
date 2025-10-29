// Shared: API Client
import axios from 'axios';

// In development, use full backend URL
// In production, use relative path (frontend is served by backend)
const API_BASE = import.meta.env.DEV
    ? (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000') + '/api'
    : '/api';

export const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

