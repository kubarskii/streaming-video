/**
 * VolumeIndicator Component
 * Displays volume level overlay (mobile-friendly)
 */
import { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { FaVolumeUp, FaVolumeDown, FaVolumeMute } from 'react-icons/fa';
import { PLAYER_CONSTANTS } from '../../../../shared/config/videoPlayer.constants';
import './VolumeIndicator.css';

/**
* Volume indicator overlay component
* @param {Object} props - Component props
* @param {number} props.volume - Volume level (0-100)
* @param {boolean} props.muted - Whether audio is muted
* @param {boolean} props.visible - Whether indicator is visible
* @param {Function} props.onHide - Callback when indicator should hide
*/
export const VolumeIndicator = ({
    volume = 100,
    muted = false,
    visible = false,
    onHide,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const hideTimerRef = useRef(null);

    useEffect(() => {
        if (visible) {
            setIsVisible(true);

            // Clear any existing timer
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }

            // Set new timer to hide after 800ms of no volume changes
            hideTimerRef.current = setTimeout(() => {
                setIsVisible(false);
                if (onHide) {
                    onHide();
                }
            }, 800);
        }

        return () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
        };
    }, [visible, volume, muted, onHide]);

    if (!isVisible) return null;

    // Determine volume icon
    const getVolumeIcon = () => {
        if (muted || volume === 0) {
            return <FaVolumeMute />;
        }
        if (volume < 50) {
            return <FaVolumeDown />;
        }
        return <FaVolumeUp />;
    };

    const displayVolume = muted ? 0 : volume;

    return (
        <div className="volume-indicator">
            <div className="volume-indicator__content">
                <div className="volume-indicator__icon">
                    {getVolumeIcon()}
                </div>
                <div className="volume-indicator__bar">
                    <div
                        className="volume-indicator__fill"
                        style={{ width: `${displayVolume}%` }}
                    />
                </div>
                <div className="volume-indicator__text">
                    {displayVolume}%
                </div>
            </div>
        </div>
    );
};

VolumeIndicator.propTypes = {
    volume: PropTypes.number,
    muted: PropTypes.bool,
    visible: PropTypes.bool,
    onHide: PropTypes.func,
};

