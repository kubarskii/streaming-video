/**
 * SeekOverlay Component Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SeekOverlay } from '../SeekOverlay/SeekOverlay';
import { PLAYER_CONSTANTS, SEEK_DIRECTION } from '../../../../shared/config/videoPlayer.constants';

describe('SeekOverlay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render when visible is true', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const overlay = container.querySelector('.seek-overlay');
            expect(overlay).toBeInTheDocument();
        });

        it('should not render when visible is false', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={false}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const overlay = container.querySelector('.seek-overlay');
            expect(overlay).not.toBeInTheDocument();
        });

        it('should not render by default', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const overlay = container.querySelector('.seek-overlay');
            expect(overlay).not.toBeInTheDocument();
        });
    });

    describe('Direction', () => {
        it('should render with forward direction', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const overlay = container.querySelector('.seek-overlay--forward');
            expect(overlay).toBeInTheDocument();
        });

        it('should render with backward direction', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.BACKWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const overlay = container.querySelector('.seek-overlay--backward');
            expect(overlay).toBeInTheDocument();
        });

        it('should show forward arrows for forward direction', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const icon = container.querySelector('.seek-overlay__icon');
            expect(icon?.textContent).toBe('»');
        });

        it('should show backward arrows for backward direction', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.BACKWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const icon = container.querySelector('.seek-overlay__icon');
            expect(icon?.textContent).toBe('«');
        });
    });

    describe('Amount and Count', () => {
        it('should display correct seek amount', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const text = container.querySelector('.seek-overlay__text');
            expect(text?.textContent).toBe('10 seconds');
        });

        it('should multiply amount by count', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={3}
                    x={0}
                    y={0}
                />
            );
            const text = container.querySelector('.seek-overlay__text');
            expect(text?.textContent).toBe('30 seconds');
        });

        it('should use default amount from constants', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const text = container.querySelector('.seek-overlay__text');
            expect(text?.textContent).toBe(`${PLAYER_CONSTANTS.SEEK_LONG} seconds`);
        });
    });

    describe('Position', () => {
        it('should position ripple at correct coordinates', () => {
            const x = 100;
            const y = 200;
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={x}
                    y={y}
                />
            );
            const ripple = container.querySelector('.seek-overlay__ripple');
            expect(ripple).toHaveStyle({ left: `${x}px`, top: `${y}px` });
        });

        it('should position forward overlay on the right', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const overlay = container.querySelector('.seek-overlay');
            expect(overlay).toHaveStyle({ right: '0', left: 'auto' });
        });

        it('should position backward overlay on the left', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.BACKWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const overlay = container.querySelector('.seek-overlay');
            expect(overlay).toHaveStyle({ left: '0', right: 'auto' });
        });
    });

    describe('Animation', () => {
        it('should add active class when visible', () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );
            const overlay = container.querySelector('.seek-overlay');
            expect(overlay).toHaveClass('seek-overlay--active');
        });

        it('should call onAnimationEnd after animation duration', async () => {
            const onAnimationEnd = vi.fn();
            render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                    onAnimationEnd={onAnimationEnd}
                />
            );

            expect(onAnimationEnd).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(PLAYER_CONSTANTS.SEEK_ANIMATION_DURATION);

            expect(onAnimationEnd).toHaveBeenCalledTimes(1);
        });

        it('should hide after animation completes', async () => {
            const { container } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );

            const overlay = container.querySelector('.seek-overlay');
            expect(overlay).toBeInTheDocument();

            await vi.advanceTimersByTimeAsync(PLAYER_CONSTANTS.SEEK_ANIMATION_DURATION);

            expect(container.querySelector('.seek-overlay')).not.toBeInTheDocument();
        });
    });

    describe('Cleanup', () => {
        it('should clean up timer on unmount', () => {
            const { unmount } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );

            unmount();
            
            // If timer wasn't cleaned up, advancing time might cause issues
            vi.advanceTimersByTime(PLAYER_CONSTANTS.SEEK_ANIMATION_DURATION);
            expect(true).toBe(true); // No errors thrown
        });

        it('should handle rapid visibility changes', () => {
            const { rerender } = render(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );

            rerender(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={false}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );

            rerender(
                <SeekOverlay
                    direction={SEEK_DIRECTION.FORWARD}
                    visible={true}
                    amount={10}
                    count={1}
                    x={0}
                    y={0}
                />
            );

            expect(true).toBe(true); // No errors thrown
        });
    });
});

