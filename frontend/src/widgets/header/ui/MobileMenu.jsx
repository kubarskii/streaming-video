import { Link } from '@tanstack/react-router';
import { Avatar, Button } from '../../../shared/ui';
import { UploadIcon, UserIcon, LogoutIcon, CloseIcon } from '../../../shared/ui';

export const MobileMenu = ({ isOpen, isAuthenticated, user, onClose, onLogout }) => {
    const handleLogout = async () => {
        await onLogout();
        onClose();
    };

    return (
        <>
            {/* Sidebar */}
            <aside className={`header-mobile-sidebar ${isOpen ? 'header-mobile-sidebar--open' : ''}`}>
                {/* Sidebar Header */}
                <div className="header-mobile-sidebar-header">
                    <h2 className="header-mobile-sidebar-title">Menu</h2>
                    <button
                        className="header-mobile-close-btn"
                        onClick={onClose}
                        aria-label="Close menu"
                    >
                        <CloseIcon size={24} />
                    </button>
                </div>

                {/* Sidebar Content */}
                <nav className="header-mobile-sidebar-content">
                    {isAuthenticated && user ? (
                        <>
                            <div className="header-mobile-user">
                                <Avatar name={user.username} size="xlarge" />
                                <div className="header-mobile-user-info">
                                    <div className="header-user-name">{user.username}</div>
                                    <div className="header-user-email">{user.email}</div>
                                </div>
                            </div>
                            <div className="header-mobile-divider" />
                            <Link to="/upload" className="header-mobile-item" onClick={onClose}>
                                <UploadIcon size={22} />
                                <span>Upload Video</span>
                            </Link>
                            <Link to="/profile" className="header-mobile-item" onClick={onClose}>
                                <UserIcon size={22} />
                                <span>My Profile</span>
                            </Link>
                            <div className="header-mobile-divider" />
                            <button onClick={handleLogout} className="header-mobile-item header-mobile-item--logout">
                                <LogoutIcon size={22} />
                                <span>Sign Out</span>
                            </button>
                        </>
                    ) : (
                        <div className="header-mobile-auth">
                            <p className="header-mobile-auth-text">Sign in to upload and manage your videos</p>
                            <Link to="/login" onClick={onClose}>
                                <Button variant="secondary" fullWidth size="large">
                                    Sign In
                                </Button>
                            </Link>
                            <Link to="/register" onClick={onClose}>
                                <Button variant="primary" fullWidth size="large">
                                    Get Started
                                </Button>
                            </Link>
                        </div>
                    )}
                </nav>
            </aside>

            {/* Overlay */}
            {isOpen && <div className="header-mobile-overlay" onClick={onClose} />}
        </>
    );
};

