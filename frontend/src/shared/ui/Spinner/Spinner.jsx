/**
 * Spinner Component
 * Loading spinner for video player
 */
import PropTypes from 'prop-types';
import { PLAYER_CONSTANTS } from '../../config/videoPlayer.constants';
import './Spinner.css';

/**
 * Spinner component
 * @param {Object} props - Component props
 * @param {number} props.size - Spinner size in pixels
 * @param {string} props.color - Spinner color
 * @param {string} props.className - Additional CSS class
 */
export const Spinner = ({
    size = PLAYER_CONSTANTS.SPINNER_SIZE,
    color = '#fff',
    className = '',
}) => {
    return (
        <div
            className={`spinner ${className}`}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                borderTopColor: color,
            }}
            role="status"
            aria-label="Loading"
        >
            <span className="spinner__sr-only">Loading...</span>
        </div>
    );
};

Spinner.propTypes = {
    size: PropTypes.number,
    color: PropTypes.string,
    className: PropTypes.string,
};

