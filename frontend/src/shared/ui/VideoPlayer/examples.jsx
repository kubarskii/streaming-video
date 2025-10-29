import React from 'react';
import { VideoPlayer } from './VideoPlayer';

/**
 * Example 1: Basic Usage
 */
export const BasicExample = () => {
    return (
        <VideoPlayer
            src="https://example.com/video.mp4"
            poster="https://example.com/thumbnail.jpg"
            title="My Awesome Video"
            autoPlay={false}
        />
    );
};

/**
 * Example 2: With Quality Options
 */
export const QualityExample = () => {
    const [currentSrc, setCurrentSrc] = React.useState('https://example.com/video-1080p.mp4');

    const qualities = [
        { id: '1080p', label: '1080p', src: 'https://example.com/video-1080p.mp4' },
        { id: '720p', label: '720p', src: 'https://example.com/video-720p.mp4' },
        { id: '480p', label: '480p', src: 'https://example.com/video-480p.mp4' },
        { id: '360p', label: '360p', src: 'https://example.com/video-360p.mp4' },
    ];

    const handleQualityChange = (quality) => {
        console.log('Changing quality to:', quality);
        setCurrentSrc(quality.src);
    };

    return (
        <VideoPlayer
            src={currentSrc}
            poster="https://example.com/thumbnail.jpg"
            title="Video with Multiple Qualities"
            qualities={qualities}
            onQualityChange={handleQualityChange}
            primaryColor="#1e90ff"
        />
    );
};

/**
 * Example 3: With Event Callbacks
 */
export const CallbackExample = () => {
    const handleTimeUpdate = (currentTime) => {
        // Track video progress
        console.log('Current time:', currentTime);

        // Example: Send analytics every 30 seconds
        if (Math.floor(currentTime) % 30 === 0 && Math.floor(currentTime) > 0) {
            console.log('Send analytics ping');
        }
    };

    const handleEnded = () => {
        console.log('Video ended');
        // Show related videos or next episode
    };

    const handleError = () => {
        console.error('Video error occurred');
        // Show error message or fallback
    };

    return (
        <VideoPlayer
            src="https://example.com/video.mp4"
            poster="https://example.com/thumbnail.jpg"
            title="Video with Callbacks"
            autoPlay={true}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onError={handleError}
        />
    );
};

/**
 * Example 4: Custom Styling
 */
export const CustomStyleExample = () => {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <VideoPlayer
                src="https://example.com/video.mp4"
                poster="https://example.com/thumbnail.jpg"
                title="Custom Styled Video"
                primaryColor="#e91e63"
                className="custom-video-player"
            />
        </div>
    );
};

/**
 * Example 5: YouTube-like Integration (Full Example)
 */
export const FullYouTubeExample = () => {
    const [videoData, setVideoData] = React.useState({
        src: 'https://example.com/video.mp4',
        poster: 'https://example.com/thumbnail.jpg',
        title: 'Amazing Nature Documentary',
        views: 1234567,
        uploadDate: '2024-01-15',
    });

    const [viewIncremented, setViewIncremented] = React.useState(false);

    const qualities = [
        { id: '1080p', label: '1080p HD' },
        { id: '720p', label: '720p HD' },
        { id: '480p', label: '480p' },
        { id: '360p', label: '360p' },
    ];

    const handleTimeUpdate = (currentTime) => {
        // Increment view count after 30 seconds (like YouTube)
        if (currentTime >= 30 && !viewIncremented) {
            setViewIncremented(true);
            console.log('Incrementing view count');
            // API call to increment views
        }
    };

    const handleQualityChange = (quality) => {
        console.log('Quality changed to:', quality.label);
        // Save user preference
        localStorage.setItem('preferredQuality', quality.id);
    };

    return (
        <div className="video-page">
            <div className="video-player-container">
                <VideoPlayer
                    src={videoData.src}
                    poster={videoData.poster}
                    title={videoData.title}
                    autoPlay={true}
                    primaryColor="#ff0000"
                    qualities={qualities}
                    onQualityChange={handleQualityChange}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => console.log('Video finished')}
                    onError={() => console.error('Playback error')}
                />
            </div>

            <div className="video-info">
                <h1>{videoData.title}</h1>
                <div className="video-stats">
                    <span>{videoData.views.toLocaleString()} views</span>
                    <span>•</span>
                    <span>{new Date(videoData.uploadDate).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    );
};

/**
 * Example 6: Mobile Responsive
 */
export const MobileExample = () => {
    return (
        <div style={{ width: '100%', maxWidth: '100vw' }}>
            <VideoPlayer
                src="https://example.com/video.mp4"
                poster="https://example.com/thumbnail.jpg"
                title="Mobile Optimized Video"
                autoPlay={false}
                primaryColor="#ff0000"
            />
        </div>
    );
};

/**
 * Example 7: Playlist Integration
 */
export const PlaylistExample = () => {
    const [currentVideoIndex, setCurrentVideoIndex] = React.useState(0);

    const playlist = [
        {
            id: 1,
            src: 'https://example.com/video1.mp4',
            poster: 'https://example.com/thumb1.jpg',
            title: 'Video 1: Introduction',
        },
        {
            id: 2,
            src: 'https://example.com/video2.mp4',
            poster: 'https://example.com/thumb2.jpg',
            title: 'Video 2: Tutorial',
        },
        {
            id: 3,
            src: 'https://example.com/video3.mp4',
            poster: 'https://example.com/thumb3.jpg',
            title: 'Video 3: Advanced Topics',
        },
    ];

    const currentVideo = playlist[currentVideoIndex];

    const handleVideoEnd = () => {
        if (currentVideoIndex < playlist.length - 1) {
            setCurrentVideoIndex(currentVideoIndex + 1);
        } else {
            console.log('Playlist finished');
        }
    };

    return (
        <div>
            <VideoPlayer
                key={currentVideo.id}
                src={currentVideo.src}
                poster={currentVideo.poster}
                title={currentVideo.title}
                autoPlay={true}
                onEnded={handleVideoEnd}
            />

            <div className="playlist">
                <h3>Playlist ({currentVideoIndex + 1}/{playlist.length})</h3>
                {playlist.map((video, index) => (
                    <div
                        key={video.id}
                        className={`playlist-item ${index === currentVideoIndex ? 'active' : ''}`}
                        onClick={() => setCurrentVideoIndex(index)}
                    >
                        <img src={video.poster} alt={video.title} />
                        <span>{video.title}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

