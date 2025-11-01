// Video Page: Skeleton Loading Component
import pageStyles from '../VideoPage.module.css';
import styles from './VideoPageSkeleton.module.css';

export const VideoPageSkeleton = () => {
    return (
        <div className={pageStyles.videoPage}>
            {/* Video Player Skeleton */}
            <div className="video-player-substrate">
                <div className={pageStyles.videoPlayerWrapper}>
                    <div className={styles.videoSkeletonPlayer}>
                        <div className={styles.skeletonPlayIcon}>
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className={pageStyles.videoContent}>
                <div className={pageStyles.videoMainColumn}>
                    <div className={pageStyles.videoDetails}>
                        {/* Title Skeleton */}
                        <div className={`${styles.skeleton} ${styles.skeletonTitle}`}></div>
                        <div className={`${styles.skeleton} ${styles.skeletonTitleShort}`}></div>

                        {/* Stats and Actions Skeleton */}
                        <div className={pageStyles.videoStats}>
                            <div className={`${styles.skeleton} ${styles.skeletonText}`}></div>
                            <div className={pageStyles.videoActions}>
                                <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
                                <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
                                <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
                            </div>
                        </div>

                        {/* Channel Skeleton */}
                        <div className={pageStyles.videoChannel}>
                            <div className={`${styles.skeleton} ${styles.skeletonText}`}></div>
                        </div>

                        {/* Description Skeleton */}
                        <div className={pageStyles.videoDescription}>
                            <div className={`${styles.skeleton} ${styles.skeletonText}`}></div>
                            <div className={`${styles.skeleton} ${styles.skeletonText}`}></div>
                            <div className={`${styles.skeleton} ${styles.skeletonTextShort}`}></div>
                        </div>

                        {/* Comments Skeleton */}
                        <div className={styles.skeletonCommentsSection}>
                            <div className={`${styles.skeleton} ${styles.skeletonText}`}></div>
                            <div className={styles.skeletonCommentForm}></div>

                            {[1, 2, 3].map((i) => (
                                <div key={i} className={styles.skeletonComment}>
                                    <div className={`${styles.skeleton} ${styles.skeletonAvatar}`}></div>
                                    <div className={styles.skeletonCommentContent}>
                                        <div className={`${styles.skeleton} ${styles.skeletonTextShort}`}></div>
                                        <div className={`${styles.skeleton} ${styles.skeletonText}`}></div>
                                        <div className={`${styles.skeleton} ${styles.skeletonText}`}></div>
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

