/**
 * FlexItem Component - Shared UI Layout System
 * Following FSD architecture - shared/ui layer
 * 
 * Flex item with grow, shrink, and basis control
 * 
 * @param {Object} props - FlexItem properties
 * @param {number | string} props.flex - Flex shorthand (e.g., 1, "1 0 auto")
 * @param {number} props.grow - Flex grow factor
 * @param {number} props.shrink - Flex shrink factor
 * @param {string} props.basis - Flex basis value
 * @param {string} props.width - Width (e.g., "50%", "300px")
 * @param {string} props.minWidth - Minimum width
 * @param {string} props.maxWidth - Maximum width
 * @param {'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'} props.alignSelf - Align self
 * @param {React.ReactNode} props.children - FlexItem content
 * @param {string} props.className - Additional CSS classes
 */
export const FlexItem = ({
    flex,
    grow,
    shrink,
    basis,
    width,
    minWidth,
    maxWidth,
    alignSelf,
    children,
    className = '',
    style = {},
    ...props
}) => {
    const inlineStyle = {
        ...style,
        ...(flex !== undefined && { flex }),
        ...(grow !== undefined && { flexGrow: grow }),
        ...(shrink !== undefined && { flexShrink: shrink }),
        ...(basis !== undefined && { flexBasis: basis }),
        ...(width !== undefined && { width }),
        ...(minWidth !== undefined && { minWidth }),
        ...(maxWidth !== undefined && { maxWidth }),
        ...(alignSelf !== undefined && { alignSelf }),
    };

    const classes = ['ui-flex-item', className].filter(Boolean).join(' ');

    return (
        <div className={classes} style={inlineStyle} {...props}>
            {children}
        </div>
    );
};

