// Video Page: Mobile Playlist Bottom Sheet Component
import { useRef, useEffect, useState } from 'react';
import { formatDuration, formatViews, formatDate } from '../../../shared/lib';
import './MobilePlaylistSheet.css';

export const MobilePlaylistSheet = ({
    isOpen,
    onClose,
    playlist,
    currentIndex,
    playlistLoading,
    onSelectVideo,
    onNext,
    onPrevious,
    hasNext,
    hasPrevious,
}) => {
    const sheetRef = useRef(null);
    const [height, setHeight] = useState(50); // Percentage: 50% = half, 10% = expanded
    const startY = useRef(0);
    const startHeight = useRef(50);
    const isDragging = useRef(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Animate in
            setTimeout(() => setHeight(50), 10);
        } else {
            document.body.style.overflow = '';
            setHeight(100);
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleExpand = () => {
        if (height === 50) {
            setHeight(10); // Expand to 90% of screen
        } else {
            setHeight(50); // Collapse to 50%
        }
    };

    const handleDragStart = (e) => {
        isDragging.current = true;
        startY.current = e.touches[0].clientY;
        startHeight.current = height;

        if (sheetRef.current) {
            sheetRef.current.style.transition = 'none';
        }
    };

    const handleDragMove = (e) => {
        if (!isDragging.current) return;

        const currentY = e.touches[0].clientY;
        const deltaY = currentY - startY.current;
        const viewportHeight = window.innerHeight;

        // Convert pixel movement to percentage
        const deltaPercent = (deltaY / viewportHeight) * 100;
        let newHeight = startHeight.current + deltaPercent;

        // Constrain between 10% and 100%
        newHeight = Math.max(10, Math.min(100, newHeight));

        setHeight(newHeight);
    };

    const handleDragEnd = (e) => {
        if (!isDragging.current) return;
        isDragging.current = false;

        if (sheetRef.current) {
            sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
        }

        // Snap to nearest position
        if (height > 70) {
            // Close if dragged down significantly
            onClose();
        } else if (height < 30) {
            // Snap to expanded (10%)
            setHeight(10);
        } else {
            // Snap to half (50%)
            setHeight(50);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="mobile-playlist-overlay" onClick={onClose} />
            <div
                ref={sheetRef}
                className="mobile-playlist-sheet"
                style={{ transform: `translateY(${height}%)` }}
            >
                <div
                    className="mobile-playlist-header"
                    onTouchStart={handleDragStart}
                    onTouchMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                    onClick={handleExpand}
                >
                    <div className="mobile-playlist-handle">
                        <div className="mobile-playlist-handle-bar" />
                    </div>
                    <div className="mobile-playlist-title-row">
                        <h3>Playlist ({currentIndex + 1}/{playlist.length})</h3>
                        <div className="mobile-playlist-header-actions">
                            <button
                                className="mobile-playlist-expand"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleExpand();
                                }}
                                aria-label={height === 50 ? "Expand" : "Collapse"}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    {height === 50 ? (
                                        <polyline points="17 11 12 6 7 11" />
                                    ) : (
                                        <polyline points="7 13 12 18 17 13" />
                                    )}
                                </svg>
                            </button>
                            <button
                                className="mobile-playlist-close"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                                aria-label="Close"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mobile-playlist-controls">
                    <button
                        type="button"
                        onClick={onPrevious}
                        disabled={!hasPrevious}
                        className="mobile-playlist-nav-button"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                        </svg>
                        Previous
                    </button>
                    <button
                        type="button"
                        onClick={onNext}
                        disabled={!hasNext}
                        className="mobile-playlist-nav-button"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 6h2v12h-2zM6 18V6l8.5 6z" />
                        </svg>
                        Next
                    </button>
                </div>

                <div className="mobile-playlist-content">
                    {playlistLoading && (
                        <div className="mobile-playlist-empty">Loading playlist…</div>
                    )}

                    {!playlistLoading && playlist.length === 0 && (
                        <div className="mobile-playlist-empty">No videos available</div>
                    )}

                    {!playlistLoading && playlist.map((item, index) => {
                        const isActive = index === currentIndex;
                        const metaParts = [];

                        if (item.durationMs) {
                            metaParts.push(formatDuration(item.durationMs));
                        }
                        metaParts.push(`${formatViews(item.views || 0)} views`);
                        if (item.uploadedAt) {
                            metaParts.push(formatDate(item.uploadedAt));
                        }

                        return (
                            <button
                                key={item.id}
                                type="button"
                                className={`mobile-playlist-item ${isActive ? 'active' : ''}`}
                                onClick={() => {
                                    onSelectVideo(index);
                                }}
                            >
                                <div className="mobile-playlist-number">
                                    {isActive ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    ) : (
                                        <span>{index + 1}</span>
                                    )}
                                </div>
                                {item.thumbnailUrl ? (
                                    <img src={item.thumbnailUrl} alt="" className="mobile-playlist-thumbnail" />
                                ) : (
                                    <div className="mobile-playlist-thumbnail placeholder">No thumbnail</div>
                                )}
                                <div className="mobile-playlist-info">
                                    <div className="mobile-playlist-video-title">{item.title}</div>
                                    <div className="mobile-playlist-meta">{metaParts.join(' • ')}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

