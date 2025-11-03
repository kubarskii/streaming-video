// Profile Layout - Shared navigation for profile pages
import { Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { Avatar, Button, UploadIcon } from '../../shared/ui';
import { useEffect, useState } from 'react';
import { channelsAPI } from '../../shared/api/channels';
import styles from './ProfilePage.module.css';

export const ProfileLayout = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [channel, setChannel] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate({ to: '/login' });
            return;
        }

        // Load channel info
        const loadChannel = async () => {
            try {
                const channelData = await channelsAPI.getChannel({ userId: user.id });
                setChannel(channelData);
            } catch (err) {
                // Channel might not exist yet
                console.debug('Channel not loaded:', err);
            }
        };

        if (user?.id) {
            loadChannel();
        }
    }, [isAuthenticated, user, navigate]);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    // Prevent body scroll when sidebar is open
    useEffect(() => {
        if (sidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [sidebarOpen]);

    if (!isAuthenticated || !user) {
        return null;
    }

    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div className={styles['studio-page']}>
            {/* Mobile Header with Hamburger */}
            <div className={styles['mobile-header']}>
                <button
                    className={styles['hamburger-button']}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Toggle navigation"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <h1 className={styles['mobile-header-title']}>Studio</h1>
                <div className={styles['mobile-header-spacer']} />
            </div>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className={styles['sidebar-overlay']}
                    onClick={closeSidebar}
                    aria-hidden="true"
                />
            )}

            {/* Mobile Floating Action Button */}
            <div className={styles['mobile-fab']}>
                <Button
                    variant="primary"
                    size="large"
                    onClick={() => navigate({ to: '/upload' })}
                    aria-label="Create content"
                >
                    <UploadIcon size={24} />
                </Button>
            </div>

            {/* Sidebar Navigation */}
            <aside className={`${styles['studio-sidebar']} ${sidebarOpen ? styles['sidebar-open'] : ''}`}>
                <div className={styles['studio-sidebar-header']}>
                    <Avatar
                        src={user?.profilePicture}
                        name={user?.username}
                        size="large"
                    />
                    <div className={styles['studio-sidebar-user-info']}>
                        <h3>{user?.username}</h3>
                        <p>{channel?.name || 'Your Channel'}</p>
                    </div>
                    <button
                        className={styles['sidebar-close-button']}
                        onClick={closeSidebar}
                        aria-label="Close navigation"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <nav className={styles['studio-nav']}>
                    <Link
                        to="/profile"
                        className={styles['studio-nav-item']}
                        activeOptions={{ exact: true }}
                        activeProps={{ className: `${styles['studio-nav-item']} ${styles['active']}` }}
                        onClick={closeSidebar}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 4l2 3h-3l-2-3h-2l2 3h-3l-2-3H8l2 3H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                        </svg>
                        <span>Content</span>
                    </Link>
                    <Link
                        to="/profile/playlists"
                        className={styles['studio-nav-item']}
                        activeOptions={{ exact: false }}
                        activeProps={{ className: `${styles['studio-nav-item']} ${styles['active']}` }}
                        onClick={closeSidebar}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8zm0 3h4v2h-4zm0-6h8v2h-8z" />
                        </svg>
                        <span>Playlists</span>
                    </Link>
                    <Link
                        to="/profile/channel"
                        className={styles['studio-nav-item']}
                        activeOptions={{ exact: false }}
                        activeProps={{ className: `${styles['studio-nav-item']} ${styles['active']}` }}
                        onClick={closeSidebar}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                        </svg>
                        <span>Customization</span>
                    </Link>
                </nav>
                <div className={styles['studio-sidebar-footer']}>
                    <Button
                        variant="primary"
                        size="medium"
                        onClick={() => {
                            navigate({ to: '/upload' });
                            closeSidebar();
                        }}
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        <UploadIcon size={18} />
                        Create
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={styles['studio-content']}>
                <Outlet />
            </main>
        </div>
    );
};

