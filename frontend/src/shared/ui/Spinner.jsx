import './Spinner.css';

/**
 * Reusable Spinner/Loader Component
 * 
 * @param {string} size - 'small' | 'medium' | 'large'
 * @param {string} variant - 'primary' | 'secondary' | 'white'
 * @param {boolean} center - Centers the spinner in container
 * @param {string} label - Accessible label for screen readers
 */
export const Spinner = ({
    size = 'medium',
    variant = 'primary',
    center = false,
    label = 'Loading...',
    className = '',
}) => {
    const containerClasses = [
        'ui-spinner-container',
        center && 'ui-spinner-container--center',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const spinnerClasses = [
        'ui-spinner',
        `ui-spinner--${size}`,
        `ui-spinner--${variant}`,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={containerClasses}>
            <div className={spinnerClasses} role="status" aria-label={label}>
                <span className="ui-spinner-sr-only">{label}</span>
            </div>
        </div>
    );
};

/**
 * Full page loading spinner
 */
export const FullPageSpinner = ({ label = 'Loading...' }) => {
    return (
        <div className="ui-spinner-fullpage">
            <Spinner size="large" label={label} />
        </div>
    );
};

