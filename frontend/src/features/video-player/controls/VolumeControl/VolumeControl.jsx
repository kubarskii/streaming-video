/**
 * VolumeControl Component
 * Volume slider with mute button
 */
import { useRef, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaVolumeUp, FaVolumeDown, FaVolumeMute } from 'react-icons/fa';
import { IconButton } from '../../../../shared/ui/IconButton';
import { PLAYER_CONSTANTS, BUTTON_SIZES } from '../../../../shared/config/videoPlayer.constants';
import './VolumeControl.css';

/**
 * Volume control component
 * @param {Object} props - Component props
 * @param {number} props.volume - Volume level (0-100)
 * @param {boolean} props.muted - Whether audio is muted
 * @param {Function} props.onVolumeChange - Volume change handler
 * @param {Function} props.onMuteToggle - Mute toggle handler
 * @param {string} props.size - Button size
 * @param {boolean} props.showSlider - Whether to show slider on desktop
 * @param {Function} props.onExpandChange - Callback when expand state changes (mobile)
 */
export const VolumeControl = ({
  volume = PLAYER_CONSTANTS.VOLUME_DEFAULT,
  muted = false,
  onVolumeChange,
  onMuteToggle,
  size = BUTTON_SIZES.MEDIUM,
  showSlider = true,
  onExpandChange,
}) => {
  const sliderRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const collapseTimeoutRef = useRef(null);

  const getVolumeIcon = () => {
    if (muted || volume === 0) {
      return <FaVolumeMute />;
    }
    if (volume < 50) {
      return <FaVolumeDown />;
    }
    return <FaVolumeUp />;
  };

  const calculateVolumeFromPosition = useCallback((clientX) => {
    if (!sliderRef.current) return volume;

    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    return Math.round(percentage);
  }, [volume]);

  // Clear any pending collapse timeout
  const clearCollapseTimeout = useCallback(() => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  }, []);

  // Collapse the slider
  const collapseSlider = useCallback(() => {
    setIsExpanded(false);
    if (onExpandChange) {
      onExpandChange(false);
    }
  }, [onExpandChange]);

  const handleSliderChange = useCallback((e) => {
    // Reset auto-collapse timer when user interacts with slider
    clearCollapseTimeout();

    const newVolume = Number(e.target.value);
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    }

    // Restart auto-collapse timer after interaction
    if (isExpanded) {
      collapseTimeoutRef.current = setTimeout(() => {
        collapseSlider();
      }, 3000);
    }
  }, [clearCollapseTimeout, onVolumeChange, isExpanded, collapseSlider]);

  // Touch handlers for mobile drag support
  const handleTouchStart = useCallback((e) => {
    // Note: Don't preventDefault here - React's onTouchStart is passive
    clearCollapseTimeout();
    setIsDragging(true);

    const touch = e.touches[0];
    const newVolume = calculateVolumeFromPosition(touch.clientX);
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    }
  }, [calculateVolumeFromPosition, onVolumeChange, clearCollapseTimeout]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    // Note: Don't preventDefault here - React's onTouchMove is passive

    const touch = e.touches[0];
    const newVolume = calculateVolumeFromPosition(touch.clientX);
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    }
  }, [isDragging, calculateVolumeFromPosition, onVolumeChange]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);

    // Restart auto-collapse timer after touch ends
    if (isExpanded) {
      collapseTimeoutRef.current = setTimeout(() => {
        collapseSlider();
      }, 3000);
    }
  }, [isExpanded, collapseSlider]);

  // Mouse handlers for desktop drag support
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);

    const newVolume = calculateVolumeFromPosition(e.clientX);
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    }
  }, [calculateVolumeFromPosition, onVolumeChange]);

  // Global drag handling for mouse and touch
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e) => {
      e.preventDefault();
      const newVolume = calculateVolumeFromPosition(e.clientX);
      if (onVolumeChange) {
        onVolumeChange(newVolume);
      }
    };

    const handleGlobalTouchMove = (e) => {
      // Only preventDefault if the event is still cancelable
      if (e.cancelable) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      const newVolume = calculateVolumeFromPosition(touch.clientX);
      if (onVolumeChange) {
        onVolumeChange(newVolume);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    const handleGlobalTouchEnd = () => {
      setIsDragging(false);

      // Restart auto-collapse timer after drag ends
      if (isExpanded) {
        collapseTimeoutRef.current = setTimeout(() => {
          collapseSlider();
        }, 3000);
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, calculateVolumeFromPosition, onVolumeChange, isExpanded, collapseSlider]);

  const ariaLabel = muted
    ? PLAYER_CONSTANTS.ARIA_LABELS.UNMUTE
    : PLAYER_CONSTANTS.ARIA_LABELS.MUTE;

  // Toggle expand state on button click (show/hide slider)
  const handleButtonClick = useCallback(() => {
    clearCollapseTimeout();

    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    if (onExpandChange) {
      onExpandChange(newExpandedState);
    }

    // Auto-collapse after 3 seconds if expanding
    if (newExpandedState) {
      collapseTimeoutRef.current = setTimeout(() => {
        collapseSlider();
      }, 3000);
    }
  }, [isExpanded, onExpandChange, clearCollapseTimeout, collapseSlider]);

  // Separate handler for mute toggle (can be used for double-click or long-press)
  const handleMuteToggle = useCallback(() => {
    onMuteToggle();
  }, [onMuteToggle]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearCollapseTimeout();
    };
  }, [clearCollapseTimeout]);

  // Click outside to collapse
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        clearCollapseTimeout();
        collapseSlider();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExpanded, clearCollapseTimeout, collapseSlider]);

  return (
    <div className="volume-control" ref={containerRef}>
      <IconButton
        icon={getVolumeIcon()}
        onClick={handleButtonClick}
        onDoubleClick={handleMuteToggle}
        size={size}
        ariaLabel={ariaLabel}
        title={ariaLabel}
        className="volume-btn"
      />

      {showSlider && (
        <div className={`volume-slider-container ${isExpanded ? 'expanded' : ''}`}>
          <input
            ref={sliderRef}
            type="range"
            className="volume-slider"
            min={PLAYER_CONSTANTS.VOLUME_MIN}
            max={PLAYER_CONSTANTS.VOLUME_MAX}
            value={muted ? 0 : volume}
            onChange={handleSliderChange}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            aria-label={PLAYER_CONSTANTS.ARIA_LABELS.VOLUME_SLIDER}
            style={{
              '--volume-width': `${muted ? 0 : volume}%`
            }}
          />
        </div>
      )}
    </div>
  );
};

VolumeControl.propTypes = {
  volume: PropTypes.number,
  muted: PropTypes.bool,
  onVolumeChange: PropTypes.func.isRequired,
  onMuteToggle: PropTypes.func.isRequired,
  size: PropTypes.oneOf(Object.values(BUTTON_SIZES)),
  showSlider: PropTypes.bool,
  onExpandChange: PropTypes.func,
};

