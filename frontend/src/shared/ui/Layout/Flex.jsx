/**
 * Flex Component - Shared UI Layout System
 * Following FSD architecture - shared/ui layer
 * 
 * Flexible flexbox container with various layout options
 * 
 * @param {Object} props - Flex properties
 * @param {'row' | 'column' | 'row-reverse' | 'column-reverse'} props.direction - Flex direction
 * @param {'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'} props.justify - Justify content
 * @param {'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'} props.align - Align items
 * @param {'nowrap' | 'wrap' | 'wrap-reverse'} props.wrap - Flex wrap
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} props.gap - Gap between items
 * @param {boolean} props.fullWidth - Makes flex container full width
 * @param {boolean} props.fullHeight - Makes flex container full height
 * @param {React.ReactNode} props.children - Flex content
 * @param {string} props.className - Additional CSS classes
 */
export const Flex = ({
    direction = 'row',
    justify = 'flex-start',
    align = 'stretch',
    wrap = 'nowrap',
    gap = 'md',
    fullWidth = false,
    fullHeight = false,
    children,
    className = '',
    ...props
}) => {
    const classes = [
        'ui-flex',
        `ui-flex--${direction}`,
        `ui-flex--justify-${justify}`,
        `ui-flex--align-${align}`,
        `ui-flex--wrap-${wrap}`,
        `ui-flex--gap-${gap}`,
        fullWidth && 'ui-flex--full-width',
        fullHeight && 'ui-flex--full-height',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} {...props}>
            {children}
        </div>
    );
};

