/**
 * SeekOverlay Component
 * Visual feedback for seek operations (especially mobile double-tap)
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { PLAYER_CONSTANTS, SEEK_DIRECTION } from '../../../../shared/config/videoPlayer.constants';
import './SeekOverlay.css';

/**
 * Seek overlay component - displays animated seek indicator
 * @param {Object} props - Component props
 * @param {string} props.direction - Seek direction ('forward' or 'backward')
 * @param {number} props.amount - Seek amount in seconds
 * @param {number} props.count - Number of consecutive seeks
 * @param {number} props.x - X position for animation
 * @param {number} props.y - Y position for animation
 * @param {boolean} props.visible - Whether overlay is visible
 * @param {Function} props.onAnimationEnd - Callback when animation ends
 */
export const SeekOverlay = ({
    direction,
    amount = PLAYER_CONSTANTS.SEEK_LONG,
    count = 1,
    x = 0,
    y = 0,
    visible = false,
    onAnimationEnd,
}) => {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (visible) {
            setIsAnimating(true);

            const timer = setTimeout(() => {
                setIsAnimating(false);
                if (onAnimationEnd) {
                    onAnimationEnd();
                }
            }, PLAYER_CONSTANTS.SEEK_ANIMATION_DURATION);

            return () => clearTimeout(timer);
        } else {
            setIsAnimating(false);
        }
    }, [visible, onAnimationEnd]);

    if (!visible && !isAnimating) return null;

    const isForward = direction === SEEK_DIRECTION.FORWARD;
    const totalSeconds = amount * count;

    // Create arrow icons (double arrow)
    const arrows = isForward ? '»' : '«';

    return (
        <div
            className={`seek-overlay seek-overlay--${direction} ${isAnimating ? 'seek-overlay--active' : ''}`}
            style={{
                left: isForward ? 'auto' : '0',
                right: isForward ? '0' : 'auto',
            }}
        >
            <div className="seek-overlay__content">
                <div className="seek-overlay__ripple" style={{ left: `${x}px`, top: `${y}px` }} />
                <div className="seek-overlay__icon">{arrows}</div>
                <div className="seek-overlay__text">{totalSeconds} seconds</div>
            </div>
        </div>
    );
};

SeekOverlay.propTypes = {
    direction: PropTypes.oneOf([SEEK_DIRECTION.FORWARD, SEEK_DIRECTION.BACKWARD]).isRequired,
    amount: PropTypes.number,
    count: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
    visible: PropTypes.bool,
    onAnimationEnd: PropTypes.func,
};

