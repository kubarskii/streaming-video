// Pages: Upload Page with Parallel Chunked Upload
// Optimized for high-speed uploads with progress tracking
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { videosAPI } from '../../shared/api/videos';
import { channelsAPI } from '../../shared/api/channels';
import chunkedUploadManagerAdvanced from '../../shared/api/chunked-upload-advanced';
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
    const [uploadSpeed, setUploadSpeed] = useState('0 MB/s');
    const [uploadedChunks, setUploadedChunks] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [activeChunks, setActiveChunks] = useState(0);
    const [eta, setEta] = useState('');
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);
    const thumbnailInputRef = useRef(null);
    const navigate = useNavigate();
    const abortControllerRef = useRef(null);
    const redirectTimeoutRef = useRef(null);

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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clear redirect timeout
            if (redirectTimeoutRef.current) {
                clearTimeout(redirectTimeoutRef.current);
            }
            
            // Terminate hash worker to prevent memory leak
            chunkedUploadManagerAdvanced.cleanup();
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
        if (!selectedFile.type.startsWith('video/')) {
            setError('Please select a video file');
            return;
        }

        const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
        if (selectedFile.size > maxSize) {
            setError('File size must be less than 10GB');
            return;
        }

        setFile(selectedFile);
        setError('');

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
        setUploadSpeed('0 MB/s');
        setUploadedChunks(0);
        setTotalChunks(0);
        setActiveChunks(0);
        setEta('');

        try {
            // Always use chunked upload for all file sizes
            console.log('🚀 Using advanced parallel chunked upload (WebWorker + Optimized)');

            const data = await chunkedUploadManagerAdvanced.uploadFile(
                file,
                {
                    title: title.trim(),
                    description: description.trim(),
                    thumbnail: thumbnail
                },
                {
                    onProgress: (progressData) => {
                        setProgress(progressData.progress);
                        setUploadSpeed(progressData.speed || '0 MB/s');
                        setUploadedChunks(progressData.uploadedChunks || 0);
                        setTotalChunks(progressData.totalChunks || 0);
                        setActiveChunks(progressData.activeChunks || 0);
                        
                        // Calculate ETA
                        if (progressData.speedBytes > 0 && progressData.uploadedBytes < progressData.totalBytes) {
                            const remainingBytes = progressData.totalBytes - progressData.uploadedBytes;
                            const secondsRemaining = remainingBytes / progressData.speedBytes;
                            
                            if (secondsRemaining < 60) {
                                setEta(`${Math.ceil(secondsRemaining)}s`);
                            } else if (secondsRemaining < 3600) {
                                const minutes = Math.ceil(secondsRemaining / 60);
                                setEta(`${minutes}m`);
                            } else {
                                const hours = Math.floor(secondsRemaining / 3600);
                                const minutes = Math.ceil((secondsRemaining % 3600) / 60);
                                setEta(`${hours}h ${minutes}m`);
                            }
                        } else {
                            setEta('');
                        }
                    },
                    onChunkComplete: (chunk) => {
                        console.log(`Chunk ${chunk.index + 1} completed`);
                    },
                    onError: (error) => {
                        console.error('Upload error:', error);
                        setError(error.message || 'Upload failed');
                    }
                }
            );

            console.log('✅ Upload complete:', data);

            // Redirect to uploaded video
            redirectTimeoutRef.current = setTimeout(() => {
                navigate({ to: `/video/${data.video.id}` });
            }, 500);

        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || err.response?.data?.error || 'Upload failed. Please try again.');
            setUploading(false);
            setProgress(0);
            setUploadSpeed('0 MB/s');
            setActiveChunks(0);
            setEta('');
        }
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setUploading(false);
        setProgress(0);
        setUploadSpeed('0 MB/s');
        setActiveChunks(0);
        setEta('');
        setFile(null);
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
                        icon={
                            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                                <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" />
                                <path d="M32 20v24M20 32h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        }
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
                <p className="upload-subtitle">Share your video with the world (up to 10GB)</p>

                <form onSubmit={handleSubmit} className="upload-form">
                    {error && (
                        <div className="upload-error">
                            {error}
                        </div>
                    )}

                    {!file ? (
                        <div
                            className={`upload-dropzone ${dragActive ? 'active' : ''}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
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
                            <p className="upload-hint">MP4, WebM, MOV, MKV up to 10GB</p>
                            <p className="upload-hint">
                                ⚡ Files over 100MB will use high-speed parallel upload
                            </p>
                        </div>
                    ) : (
                        <div className="file-preview">
                            <div className="file-info">
                                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                    <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
                                    <path d="M20 18l12 8-12 8V18z" fill="currentColor" />
                                </svg>
                                <div className="file-details">
                                    <h4>{file.name}</h4>
                                    <p>{formatFileSize(file.size)}</p>
                                    {file.size > 100 * 1024 * 1024 && (
                                        <p className="upload-hint">
                                            ⚡ Parallel chunked upload enabled
                                        </p>
                                    )}
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
                                            {eta && <span className="progress-eta"> • ETA: {eta}</span>}
                                        </p>
                                        <p className="progress-speed">
                                            ⚡ {uploadSpeed}
                                            {totalChunks > 0 && (
                                                <span className="progress-chunks">
                                                    {' '}• {uploadedChunks}/{totalChunks} chunks
                                                    {activeChunks > 0 && (
                                                        <span className="progress-active">
                                                            {' '}({activeChunks} active)
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        </p>
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

                            <div className="form-group">
                                <label htmlFor="thumbnail" className="form-label">
                                    Thumbnail (optional)
                                </label>
                                <p className="form-hint">
                                    Upload a custom thumbnail or one will be auto-generated
                                </p>
                                <input
                                    ref={thumbnailInputRef}
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
                                                className="btn-remove-thumb"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => thumbnailInputRef.current?.click()}
                                        className="btn btn-secondary"
                                        disabled={uploading}
                                    >
                                        Choose Thumbnail Image
                                    </button>
                                )}
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    onClick={uploading ? handleCancel : () => navigate({ to: '/' })}
                                    className="btn btn-secondary"
                                >
                                    {uploading ? 'Cancel Upload' : 'Cancel'}
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

