/**
 * UpNextOverlay Component
 * Next video countdown overlay (extracted from VideoPage for reusability)
 * Shows in fullscreen mode - maintains exact same contract as original
 */
import PropTypes from 'prop-types';
import { formatDurationMs } from '../../../../shared/lib/utils';
import './UpNextOverlay.css';

/**
 * Up Next overlay component - shows next video with countdown
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether overlay is visible
 * @param {number} props.countdown - Countdown in seconds (null if no countdown active)
 * @param {Object} props.nextVideo - Next video data
 * @param {string} props.nextVideo.title - Video title
 * @param {string} props.nextVideo.thumbnailUrl - Thumbnail URL
 * @param {number} props.nextVideo.durationMs - Duration in milliseconds
 * @param {string} props.nextVideo.channelName - Channel name
 * @param {Function} props.onCancel - Handler for cancel button
 * @param {Function} props.onPlayNow - Handler for play now button
 */
export const UpNextOverlay = ({
    visible = false,
    countdown = null,
    nextVideo,
    onCancel,
    onPlayNow,
}) => {
    if (!visible || !nextVideo) return null;

    return (
        <div className="next-video-countdown">
            <div className="countdown-content">
                <h3 className="countdown-header">
                    Up next in {countdown}
                </h3>
                <div className="countdown-video-preview">
                    {nextVideo.thumbnailUrl && (
                        <div className="countdown-thumbnail-wrapper">
                            <img
                                src={nextVideo.thumbnailUrl}
                                alt={nextVideo.title}
                                className="countdown-thumbnail"
                            />
                            {nextVideo.durationMs && (
                                <div className="countdown-duration">
                                    {formatDurationMs(nextVideo.durationMs)}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="countdown-video-info">
                        <h4 className="countdown-video-title">
                            {nextVideo.title || 'Next video'}
                        </h4>
                        <p className="countdown-channel-name">
                            {nextVideo.channelName || 'Channel'}
                        </p>
                    </div>
                </div>
                <div className="countdown-actions">
                    <button
                        type="button"
                        className="btn-countdown-cancel"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-countdown-play-now"
                        onClick={onPlayNow}
                    >
                        Play Now
                    </button>
                </div>
            </div>
        </div>
    );
};

UpNextOverlay.propTypes = {
    visible: PropTypes.bool,
    countdown: PropTypes.number,
    nextVideo: PropTypes.shape({
        title: PropTypes.string,
        thumbnailUrl: PropTypes.string,
        durationMs: PropTypes.number,
        channelName: PropTypes.string,
    }),
    onCancel: PropTypes.func.isRequired,
    onPlayNow: PropTypes.func.isRequired,
};

