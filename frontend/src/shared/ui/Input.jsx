import { forwardRef } from 'react';
import './Input.css';

/**
 * Reusable Input Component
 * 
 * @param {string} label - Input label
 * @param {string} error - Error message
 * @param {string} helperText - Helper text below input
 * @param {React.ReactNode} icon - Optional icon element
 * @param {boolean} fullWidth - Makes input full width
 */
export const Input = forwardRef(
    (
        {
            label,
            error,
            helperText,
            icon,
            fullWidth = false,
            className = '',
            id,
            ...props
        },
        ref
    ) => {
        const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
        const hasError = Boolean(error);

        const containerClasses = [
            'ui-input-container',
            fullWidth && 'ui-input-container--full',
            className,
        ]
            .filter(Boolean)
            .join(' ');

        const inputClasses = [
            'ui-input',
            icon && 'ui-input--with-icon',
            hasError && 'ui-input--error',
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <div className={containerClasses}>
                {label && (
                    <label htmlFor={inputId} className="ui-input-label">
                        {label}
                    </label>
                )}
                <div className="ui-input-wrapper">
                    {icon && <span className="ui-input-icon">{icon}</span>}
                    <input
                        ref={ref}
                        id={inputId}
                        className={inputClasses}
                        aria-invalid={hasError}
                        aria-describedby={
                            hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
                        }
                        {...props}
                    />
                </div>
                {error && (
                    <span id={`${inputId}-error`} className="ui-input-error">
                        {error}
                    </span>
                )}
                {!error && helperText && (
                    <span id={`${inputId}-helper`} className="ui-input-helper">
                        {helperText}
                    </span>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

