/**
 * Box Component - Shared UI Layout System
 * Following FSD architecture - shared/ui layer
 * 
 * Container with background, border, and shadow
 * 
 * @param {Object} props - Box properties
 * @param {'none' | 'sm' | 'md' | 'lg'} props.padding - Box padding
 * @param {'none' | 'sm' | 'md' | 'lg'} props.shadow - Box shadow
 * @param {boolean} props.hoverable - Add hover effect
 * @param {boolean} props.bordered - Add border
 * @param {React.ReactNode} props.children - Box content
 * @param {string} props.className - Additional CSS classes
 */
export const Box = ({
    padding = 'md',
    shadow = 'sm',
    hoverable = false,
    bordered = true,
    children,
    className = '',
    ...props
}) => {
    const classes = [
        'ui-box',
        `ui-box--padding-${padding}`,
        `ui-box--shadow-${shadow}`,
        hoverable && 'ui-box--hoverable',
        bordered && 'ui-box--bordered',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} {...props}>
            {children}
        </div>
    );
};

