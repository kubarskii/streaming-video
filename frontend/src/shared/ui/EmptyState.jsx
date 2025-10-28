import './EmptyState.css';

/**
 * Reusable Empty State Component
 * 
 * @param {React.ReactNode} icon - Icon or illustration
 * @param {string} title - Main heading
 * @param {string} description - Description text
 * @param {React.ReactNode} action - Action button or element
 */
export const EmptyState = ({
    icon,
    title,
    description,
    action,
    className = '',
}) => {
    const classes = ['ui-empty-state', className].filter(Boolean).join(' ');

    return (
        <div className={classes}>
            {icon && <div className="ui-empty-state__icon">{icon}</div>}
            {title && <h3 className="ui-empty-state__title">{title}</h3>}
            {description && <p className="ui-empty-state__description">{description}</p>}
            {action && <div className="ui-empty-state__action">{action}</div>}
        </div>
    );
};

/**
 * Default video empty state icon
 */
export const VideoEmptyIcon = () => (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="50" stroke="#e5e5e5" strokeWidth="4" />
        <path d="M45 40l30 20-30 20V40z" fill="#e5e5e5" />
    </svg>
);

/**
 * Search empty state icon
 */
export const SearchEmptyIcon = () => (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        <circle cx="50" cy="50" r="30" stroke="#e5e5e5" strokeWidth="4" />
        <path d="m70 70 20 20" stroke="#e5e5e5" strokeWidth="4" strokeLinecap="round" />
        <path d="M45 50h10M40 40l6 6" stroke="#e5e5e5" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

