import './ErrorState.css';

/**
 * Reusable Error State Component
 * 
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @param {React.ReactNode} action - Action button (e.g., retry)
 * @param {string} variant - 'error' | 'warning' | 'info'
 */
export const ErrorState = ({
    title = 'Something went wrong',
    message = 'An error occurred while loading the content.',
    action,
    variant = 'error',
    className = '',
}) => {
    const classes = [
        'ui-error-state',
        `ui-error-state--${variant}`,
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes}>
            <div className="ui-error-state__icon">
                {variant === 'error' && <ErrorIcon />}
                {variant === 'warning' && <WarningIcon />}
                {variant === 'info' && <InfoIcon />}
            </div>
            <h3 className="ui-error-state__title">{title}</h3>
            <p className="ui-error-state__message">{message}</p>
            {action && <div className="ui-error-state__action">{action}</div>}
        </div>
    );
};

const ErrorIcon = () => (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
);

const WarningIcon = () => (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const InfoIcon = () => (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

