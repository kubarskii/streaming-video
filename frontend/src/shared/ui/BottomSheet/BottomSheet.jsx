// Shared: Bottom Sheet Component - Mobile Swipeable Modal
import { useEffect, useRef, useState } from 'react';
import './BottomSheet.css';

export const BottomSheet = ({ isOpen, onClose, title, children, snapPoints = [0.3, 0.6, 0.9] }) => {
    const [position, setPosition] = useState(snapPoints[1]);
    const [isDragging, setIsDragging] = useState(false);
    const sheetRef = useRef(null);
    const dragStartY = useRef(0);
    const dragStartPosition = useRef(0);

    useEffect(() => {
        if (isOpen) {
            setPosition(snapPoints[1]); // Start at middle snap point
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, snapPoints]);

    const handleTouchStart = (e) => {
        setIsDragging(true);
        dragStartY.current = e.touches[0].clientY;
        dragStartPosition.current = position;

        // Remove transition for smooth dragging
        if (sheetRef.current) {
            sheetRef.current.style.transition = 'none';
        }
    };

    const handleTouchMove = (e) => {
        if (!isDragging) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();

        const currentY = e.touches[0].clientY;
        const deltaY = currentY - dragStartY.current;
        const viewportHeight = window.innerHeight;

        // Convert pixel movement to position (negative because dragging up increases position)
        const deltaPosition = -(deltaY / viewportHeight);
        let newPosition = dragStartPosition.current + deltaPosition;

        // Constrain between 0 and max snap point with some resistance at boundaries
        const maxSnap = snapPoints[snapPoints.length - 1];
        if (newPosition > maxSnap) {
            // Add resistance when dragging beyond max
            const excess = newPosition - maxSnap;
            newPosition = maxSnap + excess * 0.3;
        } else if (newPosition < 0) {
            // Add resistance when dragging below min
            newPosition = newPosition * 0.3;
        }

        if (sheetRef.current) {
            sheetRef.current.style.transform = `translateY(${(1 - newPosition) * 100}%)`;
        }
    };

    const handleTouchEnd = (e) => {
        if (!isDragging) return;
        setIsDragging(false);

        const currentY = e.changedTouches[0].clientY;
        const deltaY = currentY - dragStartY.current;
        const viewportHeight = window.innerHeight;
        const deltaPosition = -(deltaY / viewportHeight);

        let newPosition = dragStartPosition.current + deltaPosition;

        // Constrain to valid range
        newPosition = Math.max(0, Math.min(snapPoints[snapPoints.length - 1], newPosition));

        // Find nearest snap point
        const nearest = snapPoints.reduce((prev, curr) => {
            return Math.abs(curr - newPosition) < Math.abs(prev - newPosition) ? curr : prev;
        });

        // If dragging down significantly at lowest snap point, close
        if (deltaY > 100 && nearest === snapPoints[0]) {
            onClose();
            return;
        }

        setPosition(nearest);

        if (sheetRef.current) {
            sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
            sheetRef.current.style.transform = `translateY(${(1 - nearest) * 100}%)`;
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="bottom-sheet-overlay" onClick={handleBackdropClick}>
            <div
                ref={sheetRef}
                className="bottom-sheet"
                style={{ transform: `translateY(${(1 - position) * 100}%)` }}
            >
                <div
                    className="bottom-sheet-drag-area"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="bottom-sheet-handle">
                        <div className="bottom-sheet-handle-bar" />
                    </div>

                    {title && (
                        <div className="bottom-sheet-header">
                            <h3>{title}</h3>
                            <button
                                className="bottom-sheet-close"
                                onClick={onClose}
                                aria-label="Close"
                                onTouchStart={(e) => e.stopPropagation()}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                <div className="bottom-sheet-content">
                    {children}
                </div>
            </div>
        </div>
    );
};

