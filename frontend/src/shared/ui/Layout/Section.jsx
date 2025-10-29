/**
 * Section Component - Shared UI Layout System
 * Following FSD architecture - shared/ui layer
 * 
 * Page section with consistent spacing
 * 
 * @param {Object} props - Section properties
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} props.spacing - Vertical spacing
 * @param {boolean} props.bordered - Add border
 * @param {boolean} props.background - Add background color
 * @param {React.ReactNode} props.children - Section content
 * @param {string} props.className - Additional CSS classes
 */
export const Section = ({
    spacing = 'md',
    bordered = false,
    background = false,
    children,
    className = '',
    ...props
}) => {
    const classes = [
        'ui-section',
        `ui-section--spacing-${spacing}`,
        bordered && 'ui-section--bordered',
        background && 'ui-section--background',
        className
    ].filter(Boolean).join(' ');

    return (
        <section className={classes} {...props}>
            {children}
        </section>
    );
};

