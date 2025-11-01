/**
 * BufferingOverlay Component
 * Displays loading spinner during video buffering
 */
import PropTypes from 'prop-types';
import { Spinner } from '../../../../shared/ui/Spinner';
import { PLAYER_CONSTANTS } from '../../../../shared/config/videoPlayer.constants';
import './BufferingOverlay.css';

/**
 * Buffering overlay component
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether overlay is visible
 * @param {number} props.size - Spinner size
 */
export const BufferingOverlay = ({
    visible = false,
    size = PLAYER_CONSTANTS.SPINNER_SIZE,
}) => {
    if (!visible) return null;

    return (
        <div className="buffering-overlay">
            <Spinner size={size} />
        </div>
    );
};

BufferingOverlay.propTypes = {
    visible: PropTypes.bool,
    size: PropTypes.number,
};

