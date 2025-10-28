import { useEffect } from 'react';
import './Modal.css';

/**
 * Reusable Modal/Dialog Component
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Callback when modal closes
 * @param {string} title - Modal title
 * @param {string} size - 'small' | 'medium' | 'large' | 'full'
 * @param {boolean} closeOnOverlay - Close modal when clicking overlay
 * @param {boolean} showCloseButton - Show close button in header
 * @param {React.ReactNode} children - Modal content
 * @param {React.ReactNode} footer - Modal footer content
 */
export const Modal = ({
    isOpen = false,
    onClose,
    title,
    size = 'medium',
    closeOnOverlay = true,
    showCloseButton = true,
    children,
    footer,
    className = '',
}) => {
    // Handle ESC key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose?.();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget && closeOnOverlay) {
            onClose?.();
        }
    };

    const modalClasses = [
        'ui-modal__content',
        `ui-modal__content--${size}`,
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="ui-modal__overlay" onClick={handleOverlayClick} />
            <div className={modalClasses}>
                {(title || showCloseButton) && (
                    <div className="ui-modal__header">
                        {title && (
                            <h2 id="modal-title" className="ui-modal__title">
                                {title}
                            </h2>
                        )}
                        {showCloseButton && (
                            <button
                                type="button"
                                className="ui-modal__close"
                                onClick={onClose}
                                aria-label="Close modal"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}
                <div className="ui-modal__body">{children}</div>
                {footer && <div className="ui-modal__footer">{footer}</div>}
            </div>
        </div>
    );
};

/**
 * Confirm Dialog Component
 */
export const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
}) => {
    const handleConfirm = () => {
        onConfirm?.();
        onClose?.();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="small"
            footer={
                <div className="ui-modal__actions">
                    <button
                        type="button"
                        className="ui-button ui-button--secondary ui-button--medium"
                        onClick={onClose}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className={`ui-button ui-button--${variant} ui-button--medium`}
                        onClick={handleConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            }
        >
            <p className="ui-modal__message">{message}</p>
        </Modal>
    );
};

