import { Link } from '@tanstack/react-router';
import { Avatar } from './Avatar';
import { ClockIcon, EyeIcon, PlayIcon } from './Icons';
import { formatViews, formatRelativeTime, formatDuration } from '../lib';
import './VideoCard.css';

/**
 * Shared Video Card Component
 * 
 * @param {Object} video - Video object with title, thumbnail, views, etc.
 * @param {string} variant - 'grid' | 'list' | 'compact'
 * @param {boolean} showUser - Show user avatar and name
 * @param {boolean} showDescription - Show video description
 * @param {function} onClick - Optional click handler
 */
export const VideoCard = ({
    video,
    variant = 'grid',
    showUser = false,
    showDescription = false,
    onClick,
    className = '',
}) => {
    const thumbnailUrl = video.thumbnailUrl;
    const duration = formatDuration(video.durationMs);
    const videoLink = `/video/${video.id}`;

    const cardClasses = [
        'ui-video-card',
        `ui-video-card--${variant}`,
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const handleClick = (e) => {
        if (onClick) {
            e.preventDefault();
            onClick(video);
        }
    };

    return (
        <Link to={videoLink} className={cardClasses} onClick={handleClick}>
            {/* Thumbnail */}
            <div className="ui-video-card__thumbnail">
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={video.title}
                        className="ui-video-card__image"
                        loading="lazy"
                    />
                ) : (
                    <div className="ui-video-card__placeholder">
                        <PlayIcon size={48} />
                    </div>
                )}
                {duration && (
                    <div className="ui-video-card__duration">
                        <ClockIcon size={12} />
                        <span>{duration}</span>
                    </div>
                )}
                {video.status && video.status !== 'ready' && (
                    <div className="ui-video-card__status">{video.status}</div>
                )}
            </div>

            {/* Info */}
            <div className="ui-video-card__content">
                {showUser && video.user && variant !== 'compact' && (
                    <div className="ui-video-card__user">
                        <Avatar name={video.user.username || video.user.name} size="small" />
                    </div>
                )}

                <div className="ui-video-card__info">
                    <h3 className="ui-video-card__title">{video.title}</h3>

                    {showUser && video.user && (
                        <div className="ui-video-card__author">
                            {video.user.username || video.user.name}
                        </div>
                    )}

                    <div className="ui-video-card__meta">
                        {video.views !== undefined && (
                            <span className="ui-video-card__views">
                                <EyeIcon size={14} />
                                {formatViews(video.views)} views
                            </span>
                        )}
                        {video.uploadedAt && (
                            <span className="ui-video-card__date">
                                {formatRelativeTime(video.uploadedAt)}
                            </span>
                        )}
                    </div>

                    {showDescription && video.description && (
                        <p className="ui-video-card__description">{video.description}</p>
                    )}
                </div>
            </div>
        </Link>
    );
};

/**
 * Video Card Grid - Container for grid layout
 */
export const VideoCardGrid = ({ children, columns = 'auto', className = '' }) => {
    const gridClasses = [
        'ui-video-card-grid',
        `ui-video-card-grid--${columns}`,
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return <div className={gridClasses}>{children}</div>;
};

/**
 * Video Card Skeleton - Loading placeholder
 */
export const VideoCardSkeleton = ({ variant = 'grid' }) => {
    return (
        <div className={`ui-video-card ui-video-card--${variant} ui-video-card--skeleton`}>
            <div className="ui-video-card__thumbnail ui-skeleton" />
            <div className="ui-video-card__content">
                <div className="ui-video-card__info">
                    <div className="ui-video-card__title ui-skeleton ui-skeleton--text" />
                    <div className="ui-video-card__meta">
                        <div className="ui-skeleton ui-skeleton--text" style={{ width: '60%' }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

