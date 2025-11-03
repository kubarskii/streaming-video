/**
 * IconButton Component
 * Small, reusable icon button with configurable size and behavior
 */
import PropTypes from 'prop-types';
import { BUTTON_SIZES, PLAYER_CONSTANTS } from '../../config/videoPlayer.constants';
import './IconButton.css';

/**
 * Icon button component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.icon - Icon to display
 * @param {Function} props.onClick - Click handler
 * @param {Function} props.onDoubleClick - Double click handler
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {string} props.size - Button size (small, medium, large)
 * @param {string} props.ariaLabel - Accessibility label
 * @param {string} props.className - Additional CSS class
 * @param {string} props.title - Tooltip title
 * @param {string} props.type - Button type
 */
export const IconButton = ({
    icon,
    onClick,
    onDoubleClick,
    disabled = false,
    size = BUTTON_SIZES.MEDIUM,
    ariaLabel,
    className = '',
    title,
    type = 'button',
}) => {
    const sizeClass = `icon-btn--${size}`;
    const disabledClass = disabled ? 'icon-btn--disabled' : '';

    const handleClick = (e) => {
        // Ensure the event is not blocked by parent elements
        e.stopPropagation();
        if (onClick && !disabled) {
            onClick(e);
        }
    };

    const handleTouchEnd = (e) => {
        // For mobile, handle touch events
        e.stopPropagation();
        if (onClick && !disabled) {
            // Prevent duplicate click events
            e.preventDefault();
            onClick(e);
        }
    };

    return (
        <button
            type={type}
            className={`icon-btn ${sizeClass} ${disabledClass} ${className}`}
            onClick={handleClick}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={onDoubleClick}
            disabled={disabled}
            aria-label={ariaLabel}
            title={title || ariaLabel}
        >
            {icon}
        </button>
    );
};

IconButton.propTypes = {
    icon: PropTypes.node.isRequired,
    onClick: PropTypes.func,
    onDoubleClick: PropTypes.func,
    disabled: PropTypes.bool,
    size: PropTypes.oneOf(Object.values(BUTTON_SIZES)),
    ariaLabel: PropTypes.string.isRequired,
    className: PropTypes.string,
    title: PropTypes.string,
    type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

