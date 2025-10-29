// Example: Updated UploadPage with ChunkedUploader
// This shows how to integrate the new chunked upload system
// Copy relevant parts into your actual UploadPage.jsx

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { ChunkedUploader } from '../../shared/lib/ChunkedUploader';
import { channelsAPI } from '../../shared/api/channels';
import { Button, EmptyState } from '../../shared/ui';
import './UploadPage.css';

export const UploadPageChunked = () => {
    const { user } = useAuth();
    const [channel, setChannel] = useState(null);
    const [checkingChannel, setCheckingChannel] = useState(true);
    const [file, setFile] = useState(null);
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState(0);
    const [error, setError] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const [chunksCompleted, setChunksCompleted] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);

    const fileInputRef = useRef(null);
    const thumbnailInputRef = useRef(null);
    const uploaderRef = useRef(null);
    const navigate = useNavigate();

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

    const handleFileSelect = (selectedFile) => {
        // Validate file type
        if (!selectedFile.type.startsWith('video/')) {
            setError('Please select a video file');
            return;
        }

        // Validate file size (10GB max for chunked upload!)
        const maxSize = 10 * 1024 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            setError('File size must be less than 10GB');
            return;
        }

        setFile(selectedFile);
        setError('');

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
        setChunksCompleted(0);

        // Create new ChunkedUploader instance
        const uploader = new ChunkedUploader({
            chunkSize: 5 * 1024 * 1024, // 5MB chunks
            maxConcurrent: 3, // 3 parallel uploads
            maxRetries: 3,
            onProgress: (progressPercent, uploadedBytes, totalBytes) => {
                setProgress(Math.round(progressPercent));

                // Calculate upload speed (bytes per second)
                // This is simplified - you'd track timestamps for accuracy
                const speed = uploadedBytes / ((Date.now() - startTime) / 1000);
                setUploadSpeed(speed);
            },
            onChunkComplete: (chunkIndex, total) => {
                setChunksCompleted(chunkIndex + 1);
                setTotalChunks(total);
                console.log(`✓ Chunk ${chunkIndex + 1}/${total} uploaded`);
            },
            onError: (error) => {
                console.error('Upload error:', error);
                setError(error.message);
            },
        });

        uploaderRef.current = uploader;
        const startTime = Date.now();

        try {
            // Upload the video file with metadata
            const result = await uploader.upload(file, {
                title: title.trim(),
                description: description.trim(),
                // If you want to include thumbnail, you'd upload it separately
                // or modify the backend to accept it during finalization
            });

            console.log('Upload complete!', result);

            // Redirect to the uploaded video
            setTimeout(() => {
                navigate({ to: `/video/${result.video.id}` });
            }, 500);
        } catch (err) {
            console.error('Upload failed:', err);

            if (err.message === 'Upload cancelled') {
                setError('Upload was cancelled');
            } else {
                setError(err.message || 'Upload failed. Please try again.');
            }

            setUploading(false);
            setProgress(0);
        }
    };

    const handlePause = () => {
        if (uploaderRef.current) {
            uploaderRef.current.pause();
            setIsPaused(true);
        }
    };

    const handleResume = () => {
        if (uploaderRef.current) {
            uploaderRef.current.resume();
            setIsPaused(false);
        }
    };

    const handleCancel = () => {
        if (uploaderRef.current) {
            uploaderRef.current.cancel();
            setUploading(false);
            setProgress(0);
            setChunksCompleted(0);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatSpeed = (bytesPerSecond) => {
        return formatFileSize(bytesPerSecond) + '/s';
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

                <form onSubmit={handleSubmit} className="upload-form">
                    {error && (
                        <div className="upload-error">
                            {error}
                        </div>
                    )}

                    {!file ? (
                        <div
                            className="upload-dropzone"
                            onClick={() => fileInputRef.current?.click()}
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
                                MP4, WebM, MOV up to 10GB (chunked upload supported!)
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
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="progress-details">
                                        <p className="progress-text">
                                            {progress}% uploaded
                                        </p>
                                        <p className="progress-chunks">
                                            Chunks: {chunksCompleted}/{totalChunks}
                                        </p>
                                        <p className="progress-speed">
                                            Speed: {formatSpeed(uploadSpeed)}
                                        </p>
                                    </div>

                                    {/* Upload Controls */}
                                    <div className="upload-controls">
                                        {isPaused ? (
                                            <button
                                                type="button"
                                                onClick={handleResume}
                                                className="btn btn-primary"
                                            >
                                                Resume
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handlePause}
                                                className="btn btn-secondary"
                                            >
                                                Pause
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleCancel}
                                            className="btn btn-danger"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {file && (
                        <>
                            <div className="form-group">
                                <label htmlFor="title" className="form-label">
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    id="title"
                                    className="form-input"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter video title"
                                    required
                                    disabled={uploading}
                                    maxLength="100"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="description" className="form-label">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    className="form-textarea"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Tell viewers about your video"
                                    rows="4"
                                    disabled={uploading}
                                    maxLength="5000"
                                />
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
                                    disabled={uploading}
                                >
                                    {uploading ? 'Uploading...' : 'Upload Video'}
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
};

