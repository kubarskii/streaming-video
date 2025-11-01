/**
 * FullscreenButton Component Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FullscreenButton } from '../FullscreenButton/FullscreenButton';
import { BUTTON_SIZES } from '../../../../shared/config/videoPlayer.constants';

describe('FullscreenButton', () => {
    describe('Rendering', () => {
        it('should render fullscreen icon when not in fullscreen', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <FullscreenButton isFullscreen={false} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should render exit fullscreen icon when in fullscreen', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <FullscreenButton isFullscreen={true} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have correct aria-label when not in fullscreen', () => {
            const onToggle = vi.fn();
            render(
                <FullscreenButton isFullscreen={false} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-label', 'Fullscreen');
        });

        it('should have correct aria-label when in fullscreen', () => {
            const onToggle = vi.fn();
            render(
                <FullscreenButton isFullscreen={true} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-label', 'Exit fullscreen');
        });

        it('should have correct title attribute when not in fullscreen', () => {
            const onToggle = vi.fn();
            render(
                <FullscreenButton isFullscreen={false} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('title', 'Fullscreen');
        });

        it('should have correct title attribute when in fullscreen', () => {
            const onToggle = vi.fn();
            render(
                <FullscreenButton isFullscreen={true} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('title', 'Exit fullscreen');
        });
    });

    describe('Interaction', () => {
        it('should call onToggle when clicked', () => {
            const onToggle = vi.fn();
            render(
                <FullscreenButton isFullscreen={false} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            fireEvent.click(button);
            expect(onToggle).toHaveBeenCalledTimes(1);
        });

        it('should call onToggle when clicked in fullscreen', () => {
            const onToggle = vi.fn();
            render(
                <FullscreenButton isFullscreen={true} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            fireEvent.click(button);
            expect(onToggle).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple clicks', () => {
            const onToggle = vi.fn();
            render(
                <FullscreenButton isFullscreen={false} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            fireEvent.click(button);
            fireEvent.click(button);
            fireEvent.click(button);
            expect(onToggle).toHaveBeenCalledTimes(3);
        });
    });

    describe('Props', () => {
        it('should render with medium size by default', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <FullscreenButton isFullscreen={false} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should render with small size', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <FullscreenButton 
                    isFullscreen={false} 
                    onToggle={onToggle} 
                    size={BUTTON_SIZES.SMALL}
                />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should render with large size', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <FullscreenButton 
                    isFullscreen={false} 
                    onToggle={onToggle} 
                    size={BUTTON_SIZES.LARGE}
                />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should apply custom className', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <FullscreenButton 
                    isFullscreen={false} 
                    onToggle={onToggle} 
                    className="custom-class"
                />
            );
            const button = container.querySelector('button');
            expect(button?.className).toContain('custom-class');
        });

        it('should have fullscreen-btn class', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <FullscreenButton isFullscreen={false} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button?.className).toContain('fullscreen-btn');
        });
    });

    describe('State Changes', () => {
        it('should update icon when entering fullscreen', () => {
            const onToggle = vi.fn();
            const { rerender } = render(
                <FullscreenButton isFullscreen={false} onToggle={onToggle} />
            );
            
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Fullscreen');

            rerender(
                <FullscreenButton isFullscreen={true} onToggle={onToggle} />
            );

            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Exit fullscreen');
        });

        it('should update icon when exiting fullscreen', () => {
            const onToggle = vi.fn();
            const { rerender } = render(
                <FullscreenButton isFullscreen={true} onToggle={onToggle} />
            );
            
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Exit fullscreen');

            rerender(
                <FullscreenButton isFullscreen={false} onToggle={onToggle} />
            );

            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Fullscreen');
        });
    });
});

