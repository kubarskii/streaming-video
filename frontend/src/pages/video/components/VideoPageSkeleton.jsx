// Video Page: Skeleton Loading Component
import './VideoPageSkeleton.css';

export const VideoPageSkeleton = () => {
    return (
        <div className="video-page">
            {/* Video Player Skeleton */}
            <div className="video-player-substrate">
                <div className="video-player-wrapper">
                    <div className="video-skeleton-player">
                        <div className="skeleton-play-icon">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="video-content">
                <div className="video-main-column">
                    <div className="video-details">
                        {/* Title Skeleton */}
                        <div className="skeleton skeleton-title"></div>
                        <div className="skeleton skeleton-title-short"></div>

                        {/* Stats and Actions Skeleton */}
                        <div className="video-stats">
                            <div className="skeleton skeleton-text"></div>
                            <div className="video-actions">
                                <div className="skeleton skeleton-button"></div>
                                <div className="skeleton skeleton-button"></div>
                                <div className="skeleton skeleton-button"></div>
                            </div>
                        </div>

                        {/* Channel Skeleton */}
                        <div className="video-channel">
                            <div className="skeleton skeleton-text"></div>
                        </div>

                        {/* Description Skeleton */}
                        <div className="video-description">
                            <div className="skeleton skeleton-text"></div>
                            <div className="skeleton skeleton-text"></div>
                            <div className="skeleton skeleton-text-short"></div>
                        </div>

                        {/* Comments Skeleton */}
                        <div className="skeleton-comments-section">
                            <div className="skeleton skeleton-text"></div>
                            <div className="skeleton-comment-form"></div>

                            {[1, 2, 3].map((i) => (
                                <div key={i} className="skeleton-comment">
                                    <div className="skeleton skeleton-avatar"></div>
                                    <div className="skeleton-comment-content">
                                        <div className="skeleton skeleton-text-short"></div>
                                        <div className="skeleton skeleton-text"></div>
                                        <div className="skeleton skeleton-text"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

