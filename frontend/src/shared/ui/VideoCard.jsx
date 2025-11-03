import { Link, useNavigate } from '@tanstack/react-router';
import { Avatar } from './Avatar';
import { ClockIcon, EyeIcon, PlayIcon } from './Icons';
import { formatViews, formatRelativeTime, formatDuration } from '../lib';
import styles from './VideoCard.module.css';

/**
 * Shared Video Card Component
 * 
 * @param {Object} video - Video object with title, thumbnail, views, etc.
 * @param {string} variant - 'grid' | 'list' | 'compact' | 'management'
 * @param {boolean} showUser - Show user avatar and name
 * @param {boolean} showDescription - Show video description
 * @param {boolean} showFileSize - Show file size (for management variant)
 * @param {function} onClick - Optional click handler
 * @param {function} onThumbnailUpload - Optional thumbnail upload handler
 * @param {ReactNode} actions - Optional action buttons/content
 */
export const VideoCard = ({
    video,
    variant = 'grid',
    showUser = false,
    showDescription = false,
    showFileSize = false,
    onClick,
    onThumbnailUpload,
    actions,
    className = '',
}) => {
    const navigate = useNavigate();
    const thumbnailUrl = video.thumbnailUrl;
    const duration = formatDuration(video.durationMs);
    const videoLink = `/video/${video.id}`;

    const cardClasses = [
        styles['ui-video-card'],
        styles[`ui-video-card--${variant}`],
        actions && styles['ui-video-card--has-actions'],
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const handleCardClick = (e) => {
        // Don't navigate if clicking on a link, button, or input
        if (e.target.closest('a, button, input, label')) {
            return;
        }

        if (onClick) {
            onClick(video);
        } else if (!actions) {
            // Only auto-navigate if there are no custom actions (management mode)
            navigate({ to: videoLink });
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };

    return (
        <div className={cardClasses} onClick={handleCardClick} style={{ cursor: actions ? 'default' : 'pointer' }}>
            {/* Thumbnail */}
            <div className={styles['ui-video-card__thumbnail']}>
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={video.title}
                        className={styles['ui-video-card__image']}
                        loading="lazy"
                    />
                ) : (
                    <div className={styles['ui-video-card__placeholder']}>
                        <PlayIcon size={48} />
                    </div>
                )}
                {duration && (
                    <div className={styles['ui-video-card__duration']}>
                        <ClockIcon size={12} />
                        <span>{duration}</span>
                    </div>
                )}
                {video.status && video.status !== 'ready' && (
                    <div className={styles['ui-video-card__status']}>{video.status}</div>
                )}
                {onThumbnailUpload && (
                    <div className={styles['ui-video-card__thumbnail-overlay']}>
                        {onThumbnailUpload}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className={styles['ui-video-card__content']}>
                {showUser && video.user && variant !== 'compact' && (
                    <div className={styles['ui-video-card__user']}>
                        <Avatar name={video.user.username || video.user.name} size="small" />
                    </div>
                )}

                <div className={styles['ui-video-card__info']}>
                    <h3 className={styles['ui-video-card__title']}>{video.title}</h3>

                    {showUser && video.user && video.userId && (
                        <Link
                            to={`/channel/${video.userId}`}
                            className={styles['ui-video-card__author']}
                        >
                            {video.user.channel?.name || video.user.username || video.user.name}
                        </Link>
                    )}
                    {showUser && video.user && !video.userId && (
                        <div className={styles['ui-video-card__author']}>
                            {video.user.channel?.name || video.user.username || video.user.name}
                        </div>
                    )}

                    <div className={styles['ui-video-card__meta']}>
                        {showFileSize && video.sizeBytes && (
                            <span className={styles['ui-video-card__filesize']}>
                                {formatFileSize(video.sizeBytes)}
                            </span>
                        )}
                        {video.views !== undefined && (
                            <span className={styles['ui-video-card__views']}>
                                <EyeIcon size={14} />
                                {formatViews(video.views)} views
                            </span>
                        )}
                        {video.uploadedAt && (
                            <span className={styles['ui-video-card__date']}>
                                {formatRelativeTime(video.uploadedAt)}
                            </span>
                        )}
                    </div>

                    {showDescription && video.description && (
                        <p className={styles['ui-video-card__description']}>{video.description}</p>
                    )}
                </div>
            </div>

            {/* Custom Actions */}
            {actions && (
                <div className={styles['ui-video-card__actions']}>
                    {actions}
                </div>
            )}
        </div>
    );
};

/**
 * Video Card Grid - Container for grid layout
 */
export const VideoCardGrid = ({ children, columns = 'auto', className = '' }) => {
    const gridClasses = [
        styles['ui-video-card-grid'],
        styles[`ui-video-card-grid--${columns}`],
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
        <div className={`${styles['ui-video-card']} ${styles[`ui-video-card--${variant}`]} ${styles.uiVideoCardSkeleton}`}>
            <div className={`${styles['ui-video-card__thumbnail']} ${styles.uiSkeleton}`} />
            <div className={styles['ui-video-card__content']}>
                <div className={styles['ui-video-card__info']}>
                    <div className={`${styles['ui-video-card__title']} ${styles.uiSkeleton} ${styles.uiSkeletonText}`} />
                    <div className={styles['ui-video-card__meta']}>
                        <div className={`${styles.uiSkeleton} ${styles.uiSkeletonText}`} style={{ width: '60%' }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

