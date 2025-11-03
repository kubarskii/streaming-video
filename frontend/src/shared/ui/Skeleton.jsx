/**
 * Skeleton Components - Loading placeholders
 * Shows content structure while data is loading
 */

import styles from './Skeleton.module.css';

export const Skeleton = ({ width, height, circle = false, className = '' }) => {
    const style = {
        width: width || '100%',
        height: height || '1rem',
    };

    return (
        <div
            className={`${styles['ui-skeleton']} ${className} ${circle ? styles['ui-skeleton--circle'] : ''}`}
            style={style}
        />
    );
};

export const SkeletonText = ({ lines = 3, lastLineWidth = '60%' }) => {
    return (
        <div className={styles['ui-skeleton-text']}>
            {Array.from({ length: lines }).map((_, index) => (
                <Skeleton
                    key={index}
                    width={index === lines - 1 ? lastLineWidth : '100%'}
                    height="0.875rem"
                />
            ))}
        </div>
    );
};

export const ChannelHeaderSkeleton = () => {
    return (
        <div className={styles['ui-channel-header-skeleton']}>
            <div className={styles['skeleton-channel-info']}>
                <Skeleton circle width="80px" height="80px" />
                <div className={styles['skeleton-channel-details']}>
                    <Skeleton height="2rem" width="200px" />
                    <Skeleton height="1rem" width="300px" />
                    <Skeleton height="0.875rem" width="150px" />
                </div>
            </div>
            <Skeleton height="40px" width="120px" />
        </div>
    );
};

export const TableRowSkeleton = ({ columns = 5 }) => {
    return (
        <div className={styles['ui-table-row-skeleton']}>
            {Array.from({ length: columns }).map((_, index) => (
                <div key={index} className={styles['skeleton-cell']}>
                    <Skeleton height="1rem" width={index === 0 ? '60%' : '80%'} />
                </div>
            ))}
        </div>
    );
};

export const PlaylistCardSkeleton = () => {
    return (
        <div className={styles['ui-playlist-card-skeleton']}>
            <Skeleton height="180px" className={styles['skeleton-playlist-thumb']} />
            <div className={styles['skeleton-playlist-info']}>
                <Skeleton height="1rem" width="90%" />
                <Skeleton height="0.875rem" width="60%" />
            </div>
        </div>
    );
};

export const ChannelCardSkeleton = () => {
    return (
        <div className={styles['ui-channel-card-skeleton']}>
            <Skeleton circle width="80px" height="80px" />
            <div className={styles['skeleton-channel-info']}>
                <Skeleton height="1.25rem" width="150px" />
                <Skeleton height="0.875rem" width="100px" />
            </div>
            <Skeleton height="36px" width="100px" />
        </div>
    );
};

export const CommentSkeleton = () => {
    return (
        <div className={styles['ui-comment-skeleton']}>
            <Skeleton circle width="40px" height="40px" />
            <div className={styles['skeleton-comment-content']}>
                <div className={styles['skeleton-comment-header']}>
                    <Skeleton width="120px" height="1rem" />
                    <Skeleton width="80px" height="0.875rem" />
                </div>
                <SkeletonText lines={2} lastLineWidth="70%" />
            </div>
        </div>
    );
};

