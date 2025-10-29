/**
 * Stack Component - Shared UI Layout System
 * Following FSD architecture - shared/ui layer
 * 
 * Vertical or horizontal stack with consistent spacing
 * Simplified version of Flex for common stacking patterns
 * 
 * @param {Object} props - Stack properties
 * @param {'vertical' | 'horizontal'} props.direction - Stack direction
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'none'} props.spacing - Space between items
 * @param {'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'} props.justify - Justify content
 * @param {'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'} props.align - Align items
 * @param {boolean} props.wrap - Enable wrapping
 * @param {boolean} props.fullWidth - Makes stack full width
 * @param {React.ReactNode} props.children - Stack content
 * @param {string} props.className - Additional CSS classes
 */
export const Stack = ({
    direction = 'vertical',
    spacing = 'md',
    justify,
    align,
    wrap = false,
    fullWidth = false,
    children,
    className = '',
    ...props
}) => {
    const classes = [
        'ui-stack',
        `ui-stack--${direction}`,
        `ui-stack--spacing-${spacing}`,
        justify && `ui-stack--justify-${justify}`,
        align && `ui-stack--align-${align}`,
        wrap && 'ui-stack--wrap',
        fullWidth && 'ui-stack--full-width',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} {...props}>
            {children}
        </div>
    );
};

