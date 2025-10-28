// Entities: Video Card Component
import { Link } from '@tanstack/react-router';
import { videosAPI } from '../../../shared/api/videos';
import './VideoCard.css';

export const VideoCard = ({ video }) => {
    const formatViews = (views) => {
        if (!views && views !== 0) return '0';
        if (views >= 1000000) {
            return `${(views / 1000000).toFixed(1)}M`;
        }
        if (views >= 1000) {
            return `${(views / 1000).toFixed(1)}K`;
        }
        return views.toString();
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
            }
            return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
        }
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
        }
        if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return months === 1 ? '1 month ago' : `${months} months ago`;
        }
        const years = Math.floor(diffDays / 365);
        return years === 1 ? '1 year ago' : `${years} years ago`;
    };

    const formatDuration = (durationMs) => {
        if (!durationMs) return null;
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    };

    const videoUrl = videosAPI.getVideoUrl(video.storageKey);
    const thumbnailUrl = video.thumbnailUrl;
    const duration = formatDuration(video.durationMs);

    return (
        <Link to={`/video/${video.id}`} className="video-card">
            <div className="video-thumbnail">
                {thumbnailUrl ? (
                    <img
                        className="thumbnail-image"
                        src={thumbnailUrl}
                        alt={video.title}
                        loading="lazy"
                    />
                ) : (
                    <video
                        className="thumbnail-video"
                        src={videoUrl}
                        preload="metadata"
                    />
                )}
                {duration && (
                    <div className="video-duration">{duration}</div>
                )}
            </div>

            <div className="video-info">
                <h3 className="video-title">{video.title}</h3>

                <div className="video-meta">
                    <span className="video-views">
                        {formatViews(video.views)} views
                    </span>
                    <span className="video-date">
                        {formatDate(video.uploadedAt)}
                    </span>
                </div>

                {video.description && (
                    <p className="video-description">{video.description}</p>
                )}
            </div>
        </Link>
    );
};

