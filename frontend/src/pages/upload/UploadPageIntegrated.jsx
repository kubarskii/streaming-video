// Pages: Integrated Upload Page (Simple + Chunked)
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { videosAPI } from '../../shared/api/videos';
import { channelsAPI } from '../../shared/api/channels';
import { ChunkedUploader } from '../../shared/lib/ChunkedUploader';
import { FEATURES, getUploadStrategy } from '../../shared/config/features';
import { Button, EmptyState } from '../../shared/ui';
import './UploadPage.css';

export const UploadPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const thumbnailInputRef = useRef(null);
    const uploaderRef = useRef(null);

    const [channel, setChannel] = useState(null);
    const [checkingChannel, setCheckingChannel] = useState(true);
    const [file, setFile] = useState(null);
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadPaused, setUploadPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [chunksCompleted, setChunksCompleted] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState(0);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [uploadStrategy, setUploadStrategy] = useState(null);

    // Check if user has a channel
    useEffect(() => {
        const checkChannel = async () => {
            if (!user?.id) {
                setCheckingChannel(false);
                return;
            }

            try {
                const channelData = await channelsAPI.getChannel({ userId: user.id });
                setChannel(channelData);
            } catch (err) {
                setChannel(null);
            } finally {
                setCheckingChannel(false);
            }
        };

        checkChannel();
    }, [user]);

    // Cleanup uploader on unmount
    useEffect(() => {
        return () => {
            if (uploaderRef.current) {
                try {
                    uploaderRef.current.cancel();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };
    }, []);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const droppedFile = e.dataTransfer?.files?.[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    };

    const handleFileSelect = (selectedFile) => {
        // Validate file type
        if (!selectedFile.type.startsWith('video/')) {
            setError('Please select a video file');
            return;
        }

        // Validate file size (10GB max)
        const maxSize = 10 * 1024 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            setError('File size must be less than 10GB');
            return;
        }

        setFile(selectedFile);
        setError('');

        // Determine upload strategy
        const strategy = getUploadStrategy(selectedFile.size);
        setUploadStrategy(strategy);

        // Auto-fill title from filename
        if (!title) {
            const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
            setTitle(fileName);
        }
    };

    const handleFileInputChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
    };

    const handleThumbnailSelect = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.type.startsWith('image/')) {
                setError('Please select an image file for thumbnail');
                return;
            }

            const maxSize = 10 * 1024 * 1024;
            if (selectedFile.size > maxSize) {
                setError('Thumbnail size must be less than 10MB');
                return;
            }

            setThumbnail(selectedFile);
            setError('');

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setThumbnailPreview(reader.result);
            };
            reader.readAsDataURL(selectedFile);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!file) {
            setError('Please select a video file');
            return;
        }

        if (!title.trim()) {
            setError('Please enter a title');
            return;
        }

        setUploading(true);
        setError('');
        setProgress(0);

        const startTime = Date.now();

        try {
            if (uploadStrategy === 'chunked') {
                // Use chunked upload for large files
                await handleChunkedUpload(startTime);
            } else {
                // Use simple upload for small files
                await handleSimpleUpload(startTime);
            }
        } catch (error) {
            console.error('Upload failed:', error);

            // Provide more specific error messages
            let errorMessage = 'Upload failed. Please try again.';
            if (error.message === 'Upload cancelled') {
                errorMessage = 'Upload was cancelled.';
            } else if (error.message.includes('401') || error.message.includes('Authentication')) {
                errorMessage = 'Authentication error. Please log in again.';
            } else if (error.message.includes('Failed to initialize')) {
                errorMessage = 'Could not start upload. Please check your connection and try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            setError(errorMessage);
            setUploading(false);
            setProgress(0);
        }
    };

    const handleSimpleUpload = async (startTime) => {
        // Track for speed calculation
        let lastUpdateTime = startTime;
        let lastProgress = 0;
        let speedSamples = [];
        const MAX_SPEED_SAMPLES = 10;

        // Create FormData for simple upload
        const formData = new FormData();
        formData.append('video', file);
        formData.append('title', title);
        formData.append('description', description);
        if (thumbnail) {
            formData.append('thumbnail', thumbnail);
        }

        const result = await videosAPI.uploadVideo(
            formData,
            (progressPercent) => {
                // Progress is already calculated by the API (0-100)
                setProgress(progressPercent);

                // Calculate instantaneous speed with moving average
                const now = Date.now();
                const timeDelta = (now - lastUpdateTime) / 1000; // seconds
                const progressDelta = progressPercent - lastProgress;

                if (timeDelta > 0 && progressDelta > 0 && file.size) {
                    // Calculate bytes uploaded in this interval
                    const bytesUploaded = (progressDelta / 100) * file.size;
                    const currentSpeed = bytesUploaded / timeDelta;

                    // Add to samples for moving average
                    speedSamples.push(currentSpeed);
                    if (speedSamples.length > MAX_SPEED_SAMPLES) {
                        speedSamples.shift();
                    }

                    // Calculate moving average speed
                    const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
                    setUploadSpeed(avgSpeed);

                    // Update tracking
                    lastUpdateTime = now;
                    lastProgress = progressPercent;
                }
            },
            file.size
        );

        console.log('Simple upload complete!', result);
        navigate({ to: `/video/${result.video.id}` });
    };

    const handleChunkedUpload = async (startTime) => {
        // Cancel any existing upload first
        if (uploaderRef.current) {
            try {
                uploaderRef.current.cancel();
            } catch (e) {
                // Ignore errors from cancelling
            }
            uploaderRef.current = null;
        }

        // Track for speed calculation
        let lastUpdateTime = startTime;
        let lastUploadedBytes = 0;
        let speedSamples = [];
        const MAX_SPEED_SAMPLES = 10; // Moving average window

        // Create uploader instance with optimized settings
        const uploader = new ChunkedUploader({
            chunkSize: 20 * 1024 * 1024, // 20MB chunks (fewer requests = faster)
            maxConcurrent: 6, // 6 parallel uploads
            maxRetries: 3,
            onProgress: (progressPercent, uploadedBytes, totalBytes) => {
                setProgress(Math.round(progressPercent));

                // Calculate instantaneous speed with moving average
                const now = Date.now();
                const timeDelta = (now - lastUpdateTime) / 1000; // seconds
                const bytesDelta = uploadedBytes - lastUploadedBytes;

                if (timeDelta > 0 && bytesDelta > 0) {
                    // Instantaneous speed
                    const currentSpeed = bytesDelta / timeDelta;

                    // Add to samples for moving average
                    speedSamples.push(currentSpeed);
                    if (speedSamples.length > MAX_SPEED_SAMPLES) {
                        speedSamples.shift(); // Remove oldest sample
                    }

                    // Calculate moving average speed
                    const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
                    setUploadSpeed(avgSpeed);

                    // Update tracking
                    lastUpdateTime = now;
                    lastUploadedBytes = uploadedBytes;
                }
            },
            onChunkComplete: (chunkIndex, total) => {
                setChunksCompleted(chunkIndex + 1);
                setTotalChunks(total);
                console.log(`✓ Chunk ${chunkIndex + 1}/${total} uploaded`);
            },
            onError: (error) => {
                console.error('Chunk upload error:', error);
            },
        });

        uploaderRef.current = uploader;

        try {
            // Start upload
            const result = await uploader.upload(file, {
                title,
                description,
                thumbnail,
            });

            console.log('Chunked upload complete!', result);
            navigate({ to: `/video/${result.video.id}` });
        } finally {
            // Clean up
            uploaderRef.current = null;
        }
    };

    const handlePauseResume = () => {
        if (!uploaderRef.current) return;

        if (uploadPaused) {
            uploaderRef.current.resume();
            setUploadPaused(false);
        } else {
            uploaderRef.current.pause();
            setUploadPaused(true);
        }
    };

    const handleCancel = () => {
        if (uploaderRef.current) {
            uploaderRef.current.cancel();
        }
        setUploading(false);
        setProgress(0);
        setFile(null);
        setTitle('');
        setDescription('');
        setThumbnail(null);
        setThumbnailPreview(null);
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatSpeed = (bytesPerSecond) => {
        if (!bytesPerSecond || bytesPerSecond < 0) return '0 KB/s';

        const k = 1024;
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
        const value = bytesPerSecond / Math.pow(k, i);

        // Show 1 decimal place for values >= 10, 2 decimals for < 10
        const decimals = value >= 10 ? 1 : 2;
        return value.toFixed(decimals) + ' ' + sizes[i];
    };

    if (checkingChannel) {
        return (
            <div className="upload-page">
                <div className="upload-container">
                    <div className="loading">Checking your channel...</div>
                </div>
            </div>
        );
    }

    if (!channel) {
        return (
            <div className="upload-page">
                <div className="upload-container">
                    <EmptyState
                        title="Create Your Channel First"
                        message="You need to create a channel before you can upload videos."
                        action={
                            <Button onClick={() => navigate({ to: '/profile' })}>
                                Create Channel
                            </Button>
                        }
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="upload-page">
            <div className="upload-container">
                <h1 className="upload-title">Upload Video</h1>
                <p className="upload-subtitle">
                    Share your video with the world (up to 10GB!)
                </p>

                {FEATURES.SHOW_UPLOAD_METHOD && uploadStrategy && (
                    <div style={{
                        padding: '8px 16px',
                        background: uploadStrategy === 'chunked' ? '#e8f5e9' : '#e3f2fd',
                        borderRadius: '4px',
                        marginBottom: '16px',
                        fontSize: '14px',
                        color: '#333'
                    }}>
                        📦 Upload Method: <strong>{uploadStrategy === 'chunked' ? 'Chunked' : 'Simple'}</strong>
                        {uploadStrategy === 'chunked' && ' (Large file - resumable upload)'}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="upload-form">
                    {error && (
                        <div className="upload-error">
                            {error}
                        </div>
                    )}

                    {!file ? (
                        <div
                            className={`upload-dropzone ${dragActive ? 'active' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleFileInputChange}
                                style={{ display: 'none' }}
                            />

                            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="upload-icon">
                                <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" />
                                <path d="M32 20v24M20 32h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>

                            <h3>Drag and drop video file here</h3>
                            <p>or click to browse</p>
                            <p className="upload-hint">
                                MP4, WebM, MOV up to 10GB {FEATURES.CHUNKED_UPLOAD && '(chunked upload supported!)'}
                            </p>
                        </div>
                    ) : (
                        <div className="file-preview">
                            <div className="file-info">
                                <div className="file-details">
                                    <h4>{file.name}</h4>
                                    <p>{formatFileSize(file.size)}</p>
                                </div>
                                {!uploading && (
                                    <button
                                        type="button"
                                        onClick={() => setFile(null)}
                                        className="btn-remove"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            {uploading && (
                                <div className="upload-progress">
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                                    </div>
                                    <div className="progress-details">
                                        <p className="progress-text">{progress}% uploaded</p>
                                        {uploadStrategy === 'chunked' && totalChunks > 0 && (
                                            <p className="progress-chunks">Chunks: {chunksCompleted}/{totalChunks}</p>
                                        )}
                                        <p className="progress-speed">Speed: {formatSpeed(uploadSpeed)}</p>
                                    </div>
                                    {uploadStrategy === 'chunked' && (
                                        <div className="upload-controls">
                                            <button
                                                type="button"
                                                onClick={handlePauseResume}
                                                className="btn btn-secondary"
                                            >
                                                {uploadPaused ? 'Resume' : 'Pause'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCancel}
                                                className="btn btn-danger"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="title" className="form-label">Title *</label>
                        <input
                            id="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter video title"
                            required
                            disabled={uploading}
                            maxLength={100}
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description" className="form-label">Description</label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Tell viewers about your video"
                            rows={4}
                            disabled={uploading}
                            maxLength={5000}
                            className="form-textarea"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="thumbnail" className="form-label">
                            Thumbnail (Optional)
                        </label>
                        <div className="thumbnail-upload">
                            <input
                                ref={thumbnailInputRef}
                                id="thumbnail"
                                type="file"
                                accept="image/*"
                                onChange={handleThumbnailSelect}
                                style={{ display: 'none' }}
                                disabled={uploading}
                            />
                            {thumbnailPreview ? (
                                <div className="thumbnail-preview">
                                    <img src={thumbnailPreview} alt="Thumbnail preview" />
                                    {!uploading && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setThumbnail(null);
                                                setThumbnailPreview(null);
                                            }}
                                            className="btn-remove-thumbnail"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => thumbnailInputRef.current?.click()}
                                    className="btn-upload-thumbnail"
                                    disabled={uploading}
                                >
                                    Choose Thumbnail
                                </button>
                            )}
                        </div>
                        <p className="form-hint">
                            Recommended: 1280x720 (16:9 ratio)
                        </p>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={() => navigate({ to: '/' })}
                            className="btn btn-secondary"
                            disabled={uploading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!file || uploading}
                        >
                            {uploading ? 'Uploading...' : 'Upload Video'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UploadPage;

