/**
 * PlayPauseButton Component
 * Toggle between play and pause states
 */
import PropTypes from 'prop-types';
import { FaPlay, FaPause } from 'react-icons/fa';
import { IconButton } from '../../../../shared/ui/IconButton';
import { PLAYER_STATES, PLAYER_CONSTANTS, BUTTON_SIZES } from '../../../../shared/config/videoPlayer.constants';

/**
 * Play/Pause button component
 * @param {Object} props - Component props
 * @param {string} props.playerState - Current player state
 * @param {Function} props.onToggle - Toggle handler
 * @param {string} props.size - Button size
 * @param {string} props.className - Additional CSS class
 */
export const PlayPauseButton = ({ 
  playerState, 
  onToggle,
  size = BUTTON_SIZES.MEDIUM,
  className = '',
}) => {
  const isPlaying = playerState === PLAYER_STATES.PLAYING;
  const ariaLabel = isPlaying 
    ? PLAYER_CONSTANTS.ARIA_LABELS.PAUSE 
    : PLAYER_CONSTANTS.ARIA_LABELS.PLAY;
  
  return (
    <IconButton
      icon={isPlaying ? <FaPause /> : <FaPlay />}
      onClick={onToggle}
      size={size}
      ariaLabel={ariaLabel}
      title={ariaLabel}
      className={`play-pause-btn ${className}`}
    />
  );
};

PlayPauseButton.propTypes = {
  playerState: PropTypes.oneOf(Object.values(PLAYER_STATES)).isRequired,
  onToggle: PropTypes.func.isRequired,
  size: PropTypes.oneOf(Object.values(BUTTON_SIZES)),
  className: PropTypes.string,
};

