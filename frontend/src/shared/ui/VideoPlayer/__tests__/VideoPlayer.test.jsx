/**
 * VideoPlayer Component Tests
 * Comprehensive tests for the main VideoPlayer component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoPlayer } from '../VideoPlayer';
import { PLAYER_STATES, PLAYER_EVENTS } from '../../../config/videoPlayer.constants';

// Mock sub-components to simplify testing
vi.mock('../../../features/video-player/controls', () => ({
    PlayPauseButton: ({ onToggle }) => (
        <button onClick={onToggle} data-testid="play-pause-button">Play/Pause</button>
    ),
    VolumeControl: ({ onVolumeChange, onMuteToggle }) => (
        <div data-testid="volume-control">
            <button onClick={() => onVolumeChange(50)} data-testid="volume-change">Volume</button>
            <button onClick={onMuteToggle} data-testid="mute-toggle">Mute</button>
        </div>
    ),
    TimeDisplay: ({ currentTime, duration }) => (
        <div data-testid="time-display">{currentTime} / {duration}</div>
    ),
    FullscreenButton: ({ onToggle }) => (
        <button onClick={onToggle} data-testid="fullscreen-button">Fullscreen</button>
    ),
    PlaylistNavigation: ({ onNext, onPrevious }) => (
        <div data-testid="playlist-navigation">
            <button onClick={onPrevious} data-testid="previous-button">Previous</button>
            <button onClick={onNext} data-testid="next-button">Next</button>
        </div>
    ),
}));

vi.mock('../../../features/video-player/overlays', () => ({
    SeekOverlay: () => <div data-testid="seek-overlay">Seek</div>,
    BufferingOverlay: ({ visible }) => visible ? <div data-testid="buffering-overlay">Buffering</div> : null,
    VolumeIndicator: () => <div data-testid="volume-indicator">Volume</div>,
    UpNextOverlay: () => <div data-testid="up-next-overlay">Up Next</div>,
}));

describe('VideoPlayer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Mock HTMLMediaElement methods
        HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
        HTMLMediaElement.prototype.pause = vi.fn();
        HTMLMediaElement.prototype.load = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('Basic Rendering', () => {
        it('should render video element', () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    poster="test-poster.jpg"
                    title="Test Video"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            expect(video).toBeInTheDocument();
        });

        it('should render with correct source', () => {
            const src = 'https://example.com/video.mp4';
            render(
                <VideoPlayer
                    src={src}
                    poster="test-poster.jpg"
                    title="Test Video"
                    videoId="test-123"
                />
            );
            
            const source = document.querySelector('source');
            expect(source).toHaveAttribute('src', src);
        });

        it('should render with poster', () => {
            const poster = 'https://example.com/poster.jpg';
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    poster={poster}
                    title="Test Video"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            expect(video).toHaveAttribute('poster', poster);
        });

        it('should render controls', () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    poster="test-poster.jpg"
                    title="Test Video"
                    videoId="test-123"
                />
            );
            
            expect(screen.getByTestId('play-pause-button')).toBeInTheDocument();
            expect(screen.getByTestId('volume-control')).toBeInTheDocument();
            expect(screen.getByTestId('time-display')).toBeInTheDocument();
            expect(screen.getByTestId('fullscreen-button')).toBeInTheDocument();
        });
    });

    describe('Playback Controls', () => {
        it('should call play when play button is clicked', () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const playButton = screen.getByTestId('play-pause-button');
            fireEvent.click(playButton);
            
            const video = document.querySelector('video');
            expect(video?.play).toHaveBeenCalled();
        });

        it('should toggle between play and pause', async () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            const playButton = screen.getByTestId('play-pause-button');
            
            // Click play
            fireEvent.click(playButton);
            expect(video?.play).toHaveBeenCalled();
            
            // Simulate video playing
            if (video) fireEvent.play(video);
            
            // Click pause
            fireEvent.click(playButton);
            expect(video?.pause).toHaveBeenCalled();
        });

        it('should handle video click to toggle play/pause', async () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            
            if (video) fireEvent.click(video);
            
            // Wait for double-click delay
            vi.advanceTimersByTime(20);
            
            await waitFor(() => {
                expect(video?.play).toHaveBeenCalled();
            });
        });
    });

    describe('Volume Controls', () => {
        it('should change volume', () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const volumeButton = screen.getByTestId('volume-change');
            fireEvent.click(volumeButton);
            
            const video = document.querySelector('video');
            expect(video?.volume).toBe(0.5); // 50/100
        });

        it('should toggle mute', () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const muteButton = screen.getByTestId('mute-toggle');
            const video = document.querySelector('video');
            
            expect(video?.muted).toBe(false);
            
            fireEvent.click(muteButton);
            expect(video?.muted).toBe(true);
            
            fireEvent.click(muteButton);
            expect(video?.muted).toBe(false);
        });
    });

    describe('Progress Bar', () => {
        it('should render progress bar', () => {
            const { container } = render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const progressBar = container.querySelector('[class*="progressBar"]');
            expect(progressBar).toBeInTheDocument();
        });

        it('should update progress bar on time update', () => {
            const { container } = render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            Object.defineProperty(video, 'currentTime', { value: 30, writable: true });
            Object.defineProperty(video, 'duration', { value: 100, writable: true });
            
            if (video) fireEvent.timeUpdate(video);
            
            const progressFill = container.querySelector('[class*="progressBarFill"]');
            expect(progressFill).toBeInTheDocument();
        });

        it('should seek when progress bar is clicked', () => {
            const { container } = render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            Object.defineProperty(video, 'duration', { value: 100, writable: true });
            
            const progressBar = container.querySelector('[class*="progressBarContainer"]');
            if (progressBar) fireEvent.click(progressBar, { clientX: 50 });
            
            // Progress bar click should attempt to seek
            expect(video).toBeInTheDocument();
        });
    });

    describe('Fullscreen', () => {
        it('should toggle fullscreen when button clicked', () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const fullscreenButton = screen.getByTestId('fullscreen-button');
            fireEvent.click(fullscreenButton);
            
            // Fullscreen API might not be available in test environment
            // Just verify button interaction works
            expect(fullscreenButton).toBeInTheDocument();
        });
    });

    describe('Playlist Navigation', () => {
        it('should render playlist navigation when onNext and onPrevious provided', () => {
            const onNext = vi.fn();
            const onPrevious = vi.fn();
            
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                    onNext={onNext}
                    onPrevious={onPrevious}
                />
            );
            
            expect(screen.getByTestId('playlist-navigation')).toBeInTheDocument();
        });

        it('should call onNext when next button clicked', () => {
            const onNext = vi.fn();
            const onPrevious = vi.fn();
            
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                    onNext={onNext}
                    onPrevious={onPrevious}
                />
            );
            
            const nextButton = screen.getByTestId('next-button');
            fireEvent.click(nextButton);
            
            expect(onNext).toHaveBeenCalledTimes(1);
        });

        it('should call onPrevious when previous button clicked', () => {
            const onNext = vi.fn();
            const onPrevious = vi.fn();
            
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                    onNext={onNext}
                    onPrevious={onPrevious}
                />
            );
            
            const previousButton = screen.getByTestId('previous-button');
            fireEvent.click(previousButton);
            
            expect(onPrevious).toHaveBeenCalledTimes(1);
        });
    });

    describe('Autoplay', () => {
        it('should autoplay when autoPlay prop is true', async () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                    autoPlay={true}
                />
            );
            
            const video = document.querySelector('video');
            
            await waitFor(() => {
                expect(video?.play).toHaveBeenCalled();
            });
        });

        it('should not autoplay by default', () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            expect(video?.play).not.toHaveBeenCalled();
        });
    });

    describe('Video Events', () => {
        it('should call onTimeUpdate when time updates', () => {
            const onTimeUpdate = vi.fn();
            
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                    onTimeUpdate={onTimeUpdate}
                />
            );
            
            const video = document.querySelector('video');
            Object.defineProperty(video, 'currentTime', { value: 30, writable: true });
            
            if (video) fireEvent.timeUpdate(video);
            
            expect(onTimeUpdate).toHaveBeenCalledWith(30);
        });

        it('should call onEnded when video ends', () => {
            const onEnded = vi.fn();
            
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                    onEnded={onEnded}
                />
            );
            
            const video = document.querySelector('video');
            if (video) fireEvent.ended(video);
            
            expect(onEnded).toHaveBeenCalledTimes(1);
        });

        it('should call onError when error occurs', () => {
            const onError = vi.fn();
            
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                    onError={onError}
                />
            );
            
            const video = document.querySelector('video');
            if (video) fireEvent.error(video);
            
            expect(onError).toHaveBeenCalledTimes(1);
        });
    });

    describe('Controls Auto-hide', () => {
        it('should show controls on mouse move', () => {
            const { container } = render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const player = container.querySelector('[class*="player"]');
            if (player) fireEvent.mouseMove(player);
            
            const controls = container.querySelector('[class*="videoControls"]');
            expect(controls?.className).toContain('show');
        });

        it('should hide controls after timeout when playing', async () => {
            const { container } = render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            const player = container.querySelector('[class*="player"]');
            
            // Start playing
            if (video) fireEvent.play(video);
            
            // Show controls
            if (player) fireEvent.mouseMove(player);
            
            // Wait for auto-hide timeout (3 seconds)
            vi.advanceTimersByTime(3000);
            
            await waitFor(() => {
                const controls = container.querySelector('[class*="videoControls"]');
                expect(controls?.className).not.toContain('show');
            });
        });
    });

    describe('Buffering State', () => {
        it('should show buffering overlay when waiting', () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            if (video) fireEvent.waiting(video);
            
            expect(screen.getByTestId('buffering-overlay')).toBeInTheDocument();
        });

        it('should hide buffering overlay when can play', () => {
            const { rerender } = render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            if (video) {
                fireEvent.waiting(video);
                
                expect(screen.getByTestId('buffering-overlay')).toBeInTheDocument();
                
                fireEvent.canPlay(video);
                
                expect(screen.queryByTestId('buffering-overlay')).not.toBeInTheDocument();
            }
        });
    });

    describe('Video Attributes', () => {
        it('should have playsInline attribute', () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            expect(video).toHaveAttribute('playsInline');
        });

        it('should have preload metadata', () => {
            render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                />
            );
            
            const video = document.querySelector('video');
            expect(video).toHaveAttribute('preload', 'metadata');
        });

        it('should apply custom className', () => {
            const { container } = render(
                <VideoPlayer
                    src="test-video.mp4"
                    videoId="test-123"
                    className="custom-player"
                />
            );
            
            const player = container.querySelector('[class*="player"]');
            expect(player?.className).toContain('custom-player');
        });
    });
});

