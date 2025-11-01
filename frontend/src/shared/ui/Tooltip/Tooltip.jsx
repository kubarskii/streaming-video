/**
 * Tooltip Component
 * Simple tooltip for displaying contextual information
 */
import PropTypes from 'prop-types';
import './Tooltip.css';

/**
 * Tooltip component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Tooltip content
 * @param {number} props.x - X position in pixels
 * @param {number} props.y - Y position in pixels
 * @param {boolean} props.visible - Whether tooltip is visible
 * @param {string} props.className - Additional CSS class
 */
export const Tooltip = ({
    children,
    x = 0,
    y = 0,
    visible = true,
    className = '',
}) => {
    if (!visible) return null;

    return (
        <div
            className={`tooltip ${className}`}
            style={{
                left: `${x}px`,
                bottom: `${y}px`,
            }}
        >
            {children}
            <div className="tooltip__arrow" />
        </div>
    );
};

Tooltip.propTypes = {
    children: PropTypes.node.isRequired,
    x: PropTypes.number,
    y: PropTypes.number,
    visible: PropTypes.bool,
    className: PropTypes.string,
};

