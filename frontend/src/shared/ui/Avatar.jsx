import './Avatar.css';

/**
 * Reusable Avatar Component
 * 
 * @param {string} src - Image source URL
 * @param {string} alt - Alt text for image
 * @param {string} name - Name to generate initials from
 * @param {string} size - 'small' | 'medium' | 'large' | 'xlarge'
 * @param {string} variant - 'circle' | 'rounded' | 'square'
 */
export const Avatar = ({
    src,
    alt,
    name,
    size = 'medium',
    variant = 'circle',
    className = '',
}) => {
    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const classes = [
        'ui-avatar',
        `ui-avatar--${size}`,
        `ui-avatar--${variant}`,
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes} role="img" aria-label={alt || name}>
            {src ? (
                <img src={src} alt={alt || name} className="ui-avatar__image" />
            ) : (
                <span className="ui-avatar__initials">{getInitials(name)}</span>
            )}
        </div>
    );
};

/**
 * Avatar Group for displaying multiple avatars
 */
export const AvatarGroup = ({ children, max = 3, size = 'medium', className = '' }) => {
    const avatars = Array.isArray(children) ? children : [children];
    const displayAvatars = avatars.slice(0, max);
    const remaining = avatars.length - max;

    const classes = [
        'ui-avatar-group',
        `ui-avatar-group--${size}`,
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes}>
            {displayAvatars}
            {remaining > 0 && (
                <div className={`ui-avatar ui-avatar--${size} ui-avatar--circle ui-avatar--more`}>
                    <span className="ui-avatar__initials">+{remaining}</span>
                </div>
            )}
        </div>
    );
};

