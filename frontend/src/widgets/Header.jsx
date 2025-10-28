// Widgets: Header Component
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../shared/context/AuthContext';
import './Header.css';

export const Header = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate({ to: '/' });
    };

    return (
        <header className="header">
            <div className="header-container">
                <Link to="/" className="logo">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                        <path d="M4 4h24v24H4z" opacity="0.2" />
                        <path d="M12 9l12 7-12 7V9z" />
                    </svg>
                    <span>VideoTube</span>
                </Link>

                <div className="header-actions">
                    {isAuthenticated ? (
                        <>
                            <Link to="/upload" className="btn-upload">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                Upload
                            </Link>
                            <div className="user-menu">
                                <button className="user-button">
                                    <div className="user-avatar">
                                        {user?.username?.charAt(0).toUpperCase()}
                                    </div>
                                    <span>{user?.username}</span>
                                </button>
                                <div className="user-dropdown">
                                    <button onClick={handleLogout}>Logout</button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="btn-secondary">
                                Login
                            </Link>
                            <Link to="/register" className="btn-primary">
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};
