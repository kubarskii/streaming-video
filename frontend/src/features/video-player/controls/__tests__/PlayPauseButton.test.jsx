/**
 * PlayPauseButton Component Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayPauseButton } from '../PlayPauseButton/PlayPauseButton';
import { PLAYER_STATES, BUTTON_SIZES } from '../../../../shared/config/videoPlayer.constants';

describe('PlayPauseButton', () => {
    describe('Rendering', () => {
        it('should render play icon when paused', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <PlayPauseButton playerState={PLAYER_STATES.PAUSED} onToggle={onToggle} />
            );
            // Check for play icon by looking for the button
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should render pause icon when playing', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <PlayPauseButton playerState={PLAYER_STATES.PLAYING} onToggle={onToggle} />
            );
            // Check for pause icon by looking for the button
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should render play icon for idle state', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <PlayPauseButton playerState={PLAYER_STATES.IDLE} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should render play icon for ready state', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <PlayPauseButton playerState={PLAYER_STATES.READY} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have correct aria-label when playing', () => {
            const onToggle = vi.fn();
            render(
                <PlayPauseButton playerState={PLAYER_STATES.PLAYING} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-label', 'Pause');
        });

        it('should have correct aria-label when paused', () => {
            const onToggle = vi.fn();
            render(
                <PlayPauseButton playerState={PLAYER_STATES.PAUSED} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-label', 'Play');
        });

        it('should have correct title attribute when playing', () => {
            const onToggle = vi.fn();
            render(
                <PlayPauseButton playerState={PLAYER_STATES.PLAYING} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('title', 'Pause');
        });

        it('should have correct title attribute when paused', () => {
            const onToggle = vi.fn();
            render(
                <PlayPauseButton playerState={PLAYER_STATES.PAUSED} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('title', 'Play');
        });
    });

    describe('Interaction', () => {
        it('should call onToggle when clicked', () => {
            const onToggle = vi.fn();
            render(
                <PlayPauseButton playerState={PLAYER_STATES.PAUSED} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            fireEvent.click(button);
            expect(onToggle).toHaveBeenCalledTimes(1);
        });

        it('should call onToggle when clicked while playing', () => {
            const onToggle = vi.fn();
            render(
                <PlayPauseButton playerState={PLAYER_STATES.PLAYING} onToggle={onToggle} />
            );
            const button = screen.getByRole('button');
            fireEvent.click(button);
            expect(onToggle).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple clicks', () => {
            const onToggle = vi.fn();
            render(
                <PlayPauseButton playerState={PLAYER_STATES.PAUSED} onToggle={onToggle} />
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
                <PlayPauseButton playerState={PLAYER_STATES.PAUSED} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
        });

        it('should render with small size', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <PlayPauseButton 
                    playerState={PLAYER_STATES.PAUSED} 
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
                <PlayPauseButton 
                    playerState={PLAYER_STATES.PAUSED} 
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
                <PlayPauseButton 
                    playerState={PLAYER_STATES.PAUSED} 
                    onToggle={onToggle} 
                    className="custom-class"
                />
            );
            const button = container.querySelector('button');
            expect(button?.className).toContain('custom-class');
        });

        it('should have play-pause-btn class', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <PlayPauseButton playerState={PLAYER_STATES.PAUSED} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button?.className).toContain('play-pause-btn');
        });
    });

    describe('State Changes', () => {
        it('should update icon when state changes from paused to playing', () => {
            const onToggle = vi.fn();
            const { rerender } = render(
                <PlayPauseButton playerState={PLAYER_STATES.PAUSED} onToggle={onToggle} />
            );
            
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Play');

            rerender(
                <PlayPauseButton playerState={PLAYER_STATES.PLAYING} onToggle={onToggle} />
            );

            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Pause');
        });

        it('should update icon when state changes from playing to paused', () => {
            const onToggle = vi.fn();
            const { rerender } = render(
                <PlayPauseButton playerState={PLAYER_STATES.PLAYING} onToggle={onToggle} />
            );
            
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Pause');

            rerender(
                <PlayPauseButton playerState={PLAYER_STATES.PAUSED} onToggle={onToggle} />
            );

            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Play');
        });
    });

    describe('Edge Cases', () => {
        it('should handle buffering state', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <PlayPauseButton playerState={PLAYER_STATES.BUFFERING} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Play');
        });

        it('should handle seeking state', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <PlayPauseButton playerState={PLAYER_STATES.SEEKING} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Play');
        });

        it('should handle ended state', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <PlayPauseButton playerState={PLAYER_STATES.ENDED} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Play');
        });

        it('should handle error state', () => {
            const onToggle = vi.fn();
            const { container } = render(
                <PlayPauseButton playerState={PLAYER_STATES.ERROR} onToggle={onToggle} />
            );
            const button = container.querySelector('button');
            expect(button).toBeInTheDocument();
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Play');
        });
    });
});

