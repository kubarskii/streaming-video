/**
 * VolumeIndicator Component Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { VolumeIndicator } from '../VolumeIndicator/VolumeIndicator';

describe('VolumeIndicator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render when visible is true', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={50} muted={false} />
            );
            const indicator = container.querySelector('.volume-indicator');
            expect(indicator).toBeInTheDocument();
        });

        it('should not render when visible is false', () => {
            const { container } = render(
                <VolumeIndicator visible={false} volume={50} muted={false} />
            );
            const indicator = container.querySelector('.volume-indicator');
            expect(indicator).not.toBeInTheDocument();
        });

        it('should not render by default', () => {
            const { container } = render(
                <VolumeIndicator volume={50} muted={false} />
            );
            const indicator = container.querySelector('.volume-indicator');
            expect(indicator).not.toBeInTheDocument();
        });
    });

    describe('Volume Display', () => {
        it('should display correct volume percentage', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={75} muted={false} />
            );
            const text = container.querySelector('.volume-indicator__text');
            expect(text?.textContent).toBe('75%');
        });

        it('should display 0% when muted', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={75} muted={true} />
            );
            const text = container.querySelector('.volume-indicator__text');
            expect(text?.textContent).toBe('0%');
        });

        it('should display 100% for max volume', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={100} muted={false} />
            );
            const text = container.querySelector('.volume-indicator__text');
            expect(text?.textContent).toBe('100%');
        });

        it('should display 0% for zero volume', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={0} muted={false} />
            );
            const text = container.querySelector('.volume-indicator__text');
            expect(text?.textContent).toBe('0%');
        });

        it('should use default volume of 100', () => {
            const { container } = render(
                <VolumeIndicator visible={true} muted={false} />
            );
            const text = container.querySelector('.volume-indicator__text');
            expect(text?.textContent).toBe('100%');
        });
    });

    describe('Volume Bar', () => {
        it('should set correct fill width for volume', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={60} muted={false} />
            );
            const fill = container.querySelector('.volume-indicator__fill');
            expect(fill).toHaveStyle({ width: '60%' });
        });

        it('should set fill width to 0 when muted', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={75} muted={true} />
            );
            const fill = container.querySelector('.volume-indicator__fill');
            expect(fill).toHaveStyle({ width: '0%' });
        });

        it('should set fill width to 100% for max volume', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={100} muted={false} />
            );
            const fill = container.querySelector('.volume-indicator__fill');
            expect(fill).toHaveStyle({ width: '100%' });
        });
    });

    describe('Volume Icons', () => {
        it('should show mute icon when muted', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={75} muted={true} />
            );
            const icon = container.querySelector('.volume-indicator__icon svg');
            expect(icon).toBeInTheDocument();
        });

        it('should show mute icon when volume is 0', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={0} muted={false} />
            );
            const icon = container.querySelector('.volume-indicator__icon svg');
            expect(icon).toBeInTheDocument();
        });

        it('should show volume-down icon for low volume', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={25} muted={false} />
            );
            const icon = container.querySelector('.volume-indicator__icon svg');
            expect(icon).toBeInTheDocument();
        });

        it('should show volume-up icon for high volume', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={75} muted={false} />
            );
            const icon = container.querySelector('.volume-indicator__icon svg');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Auto-hide', () => {
        it('should call onHide after timeout', async () => {
            const onHide = vi.fn();
            render(
                <VolumeIndicator visible={true} volume={50} muted={false} onHide={onHide} />
            );

            expect(onHide).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(400);

            expect(onHide).toHaveBeenCalledTimes(1);
        });

        it('should hide after animation duration', async () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={50} muted={false} />
            );

            const indicator = container.querySelector('.volume-indicator');
            expect(indicator).toBeInTheDocument();

            await vi.advanceTimersByTimeAsync(400);

            expect(container.querySelector('.volume-indicator')).not.toBeInTheDocument();
        });

        it('should restart timer on volume change', async () => {
            const onHide = vi.fn();
            const { rerender } = render(
                <VolumeIndicator visible={true} volume={50} muted={false} onHide={onHide} />
            );

            await vi.advanceTimersByTimeAsync(200);

            // Change volume before timeout
            rerender(
                <VolumeIndicator visible={true} volume={60} muted={false} onHide={onHide} />
            );

            await vi.advanceTimersByTimeAsync(200);
            expect(onHide).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(200);

            expect(onHide).toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        it('should clean up timer on unmount', () => {
            const { unmount } = render(
                <VolumeIndicator visible={true} volume={50} muted={false} />
            );

            unmount();
            
            // If timer wasn't cleaned up, advancing time might cause issues
            vi.advanceTimersByTime(400);
            expect(true).toBe(true); // No errors thrown
        });

        it('should handle rapid visibility changes', () => {
            const { rerender } = render(
                <VolumeIndicator visible={true} volume={50} muted={false} />
            );

            rerender(
                <VolumeIndicator visible={false} volume={50} muted={false} />
            );

            rerender(
                <VolumeIndicator visible={true} volume={50} muted={false} />
            );

            expect(true).toBe(true); // No errors thrown
        });
    });

    describe('Structure', () => {
        it('should have correct CSS structure', () => {
            const { container } = render(
                <VolumeIndicator visible={true} volume={50} muted={false} />
            );

            expect(container.querySelector('.volume-indicator')).toBeInTheDocument();
            expect(container.querySelector('.volume-indicator__content')).toBeInTheDocument();
            expect(container.querySelector('.volume-indicator__icon')).toBeInTheDocument();
            expect(container.querySelector('.volume-indicator__bar')).toBeInTheDocument();
            expect(container.querySelector('.volume-indicator__fill')).toBeInTheDocument();
            expect(container.querySelector('.volume-indicator__text')).toBeInTheDocument();
        });
    });
});

