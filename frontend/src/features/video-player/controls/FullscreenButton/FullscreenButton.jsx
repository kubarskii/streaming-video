/**
 * FullscreenButton Component
 * Toggle fullscreen mode
 */
import PropTypes from 'prop-types';
import { FaExpand, FaCompress } from 'react-icons/fa';
import { IconButton } from '../../../../shared/ui/IconButton';
import { PLAYER_CONSTANTS, BUTTON_SIZES } from '../../../../shared/config/videoPlayer.constants';

/**
 * Fullscreen button component
 * @param {Object} props - Component props
 * @param {boolean} props.isFullscreen - Whether in fullscreen mode
 * @param {Function} props.onToggle - Toggle handler
 * @param {string} props.size - Button size
 * @param {string} props.className - Additional CSS class
 */
export const FullscreenButton = ({ 
  isFullscreen = false,
  onToggle,
  size = BUTTON_SIZES.MEDIUM,
  className = '',
}) => {
  const ariaLabel = isFullscreen 
    ? PLAYER_CONSTANTS.ARIA_LABELS.EXIT_FULLSCREEN 
    : PLAYER_CONSTANTS.ARIA_LABELS.FULLSCREEN;
  
  return (
    <IconButton
      icon={isFullscreen ? <FaCompress /> : <FaExpand />}
      onClick={onToggle}
      size={size}
      ariaLabel={ariaLabel}
      title={ariaLabel}
      className={`fullscreen-btn ${className}`}
    />
  );
};

FullscreenButton.propTypes = {
  isFullscreen: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  size: PropTypes.oneOf(Object.values(BUTTON_SIZES)),
  className: PropTypes.string,
};

