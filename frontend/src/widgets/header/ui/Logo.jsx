import { Link } from '@tanstack/react-router';

export const Logo = () => {
    return (
        <Link to="/" className="header-logo">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="22" fill="url(#logoGradient)" />
                <path d="M18 15l16 9-16 9V15z" fill="white" />
                <defs>
                    <linearGradient id="logoGradient" x1="0" y1="0" x2="48" y2="48">
                        <stop offset="0%" stopColor="#667eea" />
                        <stop offset="100%" stopColor="#764ba2" />
                    </linearGradient>
                </defs>
            </svg>
            <span className="header-logo-text">VideoTube</span>
        </Link>
    );
};

