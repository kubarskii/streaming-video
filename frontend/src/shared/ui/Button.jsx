import './Button.css';

/**
 * Reusable Button Component (Shared UI Kit)
 * Following FSD architecture - shared/ui layer
 * 
 * @param {Object} props - Button properties
 * @param {'primary' | 'secondary' | 'danger' | 'ghost'} props.variant - Button style variant
 * @param {'small' | 'medium' | 'large'} props.size - Button size
 * @param {boolean} props.fullWidth - Makes button full width
 * @param {boolean} props.loading - Shows loading state
 * @param {boolean} props.disabled - Disables button
 * @param {React.ReactNode} props.icon - Optional icon element
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.className - Additional CSS classes
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

