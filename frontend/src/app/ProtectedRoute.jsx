// App: Protected Route Component
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../shared/context/AuthContext';
import { useEffect } from 'react';

export const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            navigate({ to: '/login' });
        }
    }, [isAuthenticated, loading, navigate]);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return children;
};
