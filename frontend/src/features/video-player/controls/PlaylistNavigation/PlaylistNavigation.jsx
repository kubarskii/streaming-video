/**
 * PlaylistNavigation Component
 * Previous/Next buttons for playlist navigation
 */
import PropTypes from 'prop-types';
import { FaStepBackward, FaStepForward } from 'react-icons/fa';
import { IconButton } from '../../../../shared/ui/IconButton';
import { BUTTON_SIZES } from '../../../../shared/config/videoPlayer.constants';
import './PlaylistNavigation.css';

/**
 * Playlist navigation component
 * @param {Object} props - Component props
 * @param {Function} props.onPrevious - Previous video handler
 * @param {Function} props.onNext - Next video handler
 * @param {boolean} props.canPlayPrevious - Whether can play previous
 * @param {boolean} props.canPlayNext - Whether can play next
 * @param {string} props.size - Button size
 * @param {string} props.className - Additional CSS class
 */
export const PlaylistNavigation = ({ 
  onPrevious,
  onNext,
  canPlayPrevious = false,
  canPlayNext = false,
  size = BUTTON_SIZES.MEDIUM,
  className = '',
}) => {
  // Only render if at least one navigation is available
  if (!onPrevious && !onNext) {
    return null;
  }
  
  return (
    <div className={`playlist-navigation ${className}`}>
      {onPrevious && (
        <IconButton
          icon={<FaStepBackward />}
          onClick={onPrevious}
          disabled={!canPlayPrevious}
          size={size}
          ariaLabel="Previous video (p)"
          title="Previous video (p)"
          className="playlist-nav-btn playlist-nav-btn--previous"
        />
      )}
      
      {onNext && (
        <IconButton
          icon={<FaStepForward />}
          onClick={onNext}
          disabled={!canPlayNext}
          size={size}
          ariaLabel="Next video (n)"
          title="Next video (n)"
          className="playlist-nav-btn playlist-nav-btn--next"
        />
      )}
    </div>
  );
};

PlaylistNavigation.propTypes = {
  onPrevious: PropTypes.func,
  onNext: PropTypes.func,
  canPlayPrevious: PropTypes.bool,
  canPlayNext: PropTypes.bool,
  size: PropTypes.oneOf(Object.values(BUTTON_SIZES)),
  className: PropTypes.string,
};

