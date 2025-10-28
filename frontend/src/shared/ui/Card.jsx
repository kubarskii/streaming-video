import './Card.css';

/**
 * Reusable Card Component
 * 
 * @param {string} variant - 'default' | 'outlined' | 'elevated'
 * @param {string} padding - 'none' | 'small' | 'medium' | 'large'
 * @param {boolean} hoverable - Adds hover effect
 * @param {React.ReactNode} children - Card content
 */
export const Card = ({
    variant = 'default',
    padding = 'medium',
    hoverable = false,
    className = '',
    children,
    ...props
}) => {
    const classes = [
        'ui-card',
        `ui-card--${variant}`,
        `ui-card--padding-${padding}`,
        hoverable && 'ui-card--hoverable',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes} {...props}>
            {children}
        </div>
    );
};

/**
 * Card Header Component
 */
export const CardHeader = ({ title, subtitle, action, className = '' }) => {
    return (
        <div className={`ui-card-header ${className}`}>
            <div className="ui-card-header__content">
                {title && <h3 className="ui-card-header__title">{title}</h3>}
                {subtitle && <p className="ui-card-header__subtitle">{subtitle}</p>}
            </div>
            {action && <div className="ui-card-header__action">{action}</div>}
        </div>
    );
};

/**
 * Card Body Component
 */
export const CardBody = ({ children, className = '' }) => {
    return <div className={`ui-card-body ${className}`}>{children}</div>;
};

/**
 * Card Footer Component
 */
export const CardFooter = ({ children, className = '' }) => {
    return <div className={`ui-card-footer ${className}`}>{children}</div>;
};

