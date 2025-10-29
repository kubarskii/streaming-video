/**
 * Container Component - Shared UI Layout System
 * Following FSD architecture - shared/ui layer
 * 
 * Provides max-width container with responsive padding
 * 
 * @param {Object} props - Container properties
 * @param {'narrow' | 'normal' | 'wide' | 'full'} props.size - Container width
 * @param {boolean} props.noPadding - Remove horizontal padding
 * @param {React.ReactNode} props.children - Container content
 * @param {string} props.className - Additional CSS classes
 */
export const Container = ({
    size = 'normal',
    noPadding = false,
    children,
    className = '',
    ...props
}) => {
    const classes = [
        'ui-container',
        `ui-container--${size}`,
        noPadding && 'ui-container--no-padding',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} {...props}>
            {children}
        </div>
    );
};

