import { forwardRef } from 'react';
import './Textarea.css';

/**
 * Reusable Textarea Component
 * 
 * @param {string} label - Textarea label
 * @param {string} error - Error message
 * @param {string} helperText - Helper text below textarea
 * @param {boolean} fullWidth - Makes textarea full width
 * @param {boolean} autoResize - Auto resize based on content
 */
export const Textarea = forwardRef(
    (
        {
            label,
            error,
            helperText,
            fullWidth = false,
            autoResize = false,
            className = '',
            id,
            rows = 4,
            onChange,
            ...props
        },
        ref
    ) => {
        const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
        const hasError = Boolean(error);

        const containerClasses = [
            'ui-textarea-container',
            fullWidth && 'ui-textarea-container--full',
            className,
        ]
            .filter(Boolean)
            .join(' ');

        const textareaClasses = [
            'ui-textarea',
            hasError && 'ui-textarea--error',
            autoResize && 'ui-textarea--auto',
        ]
            .filter(Boolean)
            .join(' ');

        const handleChange = (e) => {
            if (autoResize) {
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
            }
            onChange?.(e);
        };

        return (
            <div className={containerClasses}>
                {label && (
                    <label htmlFor={textareaId} className="ui-textarea-label">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={textareaId}
                    rows={rows}
                    className={textareaClasses}
                    aria-invalid={hasError}
                    aria-describedby={
                        hasError ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined
                    }
                    onChange={handleChange}
                    {...props}
                />
                {error && (
                    <span id={`${textareaId}-error`} className="ui-textarea-error">
                        {error}
                    </span>
                )}
                {!error && helperText && (
                    <span id={`${textareaId}-helper`} className="ui-textarea-helper">
                        {helperText}
                    </span>
                )}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';

