import './Button.css';

/**
 * Reusable Button Component
 * 
 * @param {string} variant - 'primary' | 'secondary' | 'danger' | 'ghost'
 * @param {string} size - 'small' | 'medium' | 'large'
 * @param {boolean} fullWidth - Makes button full width
 * @param {boolean} loading - Shows loading state
 * @param {React.ReactNode} icon - Optional icon element
 * @param {React.ReactNode} children - Button content
 */
export const Button = ({
    variant = 'primary',
    size = 'medium',
    fullWidth = false,
    loading = false,
    disabled = false,
    icon,
    children,
    className = '',
    ...props
}) => {
    const classes = [
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth && 'ui-button--full',
        loading && 'ui-button--loading',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button
            className={classes}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <span className="ui-button__spinner" />
            )}
            {!loading && icon && (
                <span className="ui-button__icon">{icon}</span>
            )}
            {children}
        </button>
    );
};

