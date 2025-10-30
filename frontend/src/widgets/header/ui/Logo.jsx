import { Link } from '@tanstack/react-router';

export const Logo = () => {
    return (
        <Link to="/" className="header-logo">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="22" fill="#ff0000" />
                <path d="M18 15l16 9-16 9V15z" fill="white" />
            </svg>
            <span className="header-logo-text">VideoTube</span>
        </Link>
    );
};

