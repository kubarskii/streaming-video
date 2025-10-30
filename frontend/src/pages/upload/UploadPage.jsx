// Pages: Upload Page
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { videosAPI } from '../../shared/api/videos';
import { channelsAPI } from '../../shared/api/channels';
import { Button, EmptyState } from '../../shared/ui';
import './UploadPage.css';

export const UploadPage = () => {
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
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);
    const thumbnailInputRef = useRef(null);
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
                // User doesn't have a channel
                setChannel(null);
            } finally {
                setCheckingChannel(false);
            }
        };

        checkChannel();
    }, [user]);

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

        // Validate file size (2GB max)
        const maxSize = 5 * 1024 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            setError('File size must be less than 5GB');
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
            // Validate file type
            if (!selectedFile.type.startsWith('image/')) {
                setError('Please select an image file for thumbnail');
                return;
            }

            // Validate file size (10MB max for thumbnail)
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

        const formData = new FormData();
        formData.append('video', file);
        formData.append('title', title.trim());
        formData.append('description', description.trim());

        // Add thumbnail if provided
        if (thumbnail) {
            formData.append('thumbnail', thumbnail);
        }

        try {
            const data = await videosAPI.uploadVideo(formData, setProgress, file.size);

            // Redirect to the uploaded video
            setTimeout(() => {
                navigate({ to: `/video/${data.video.id}` });
            }, 500);
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.response?.data?.error || 'Upload failed. Please try again.');
            setUploading(false);
            setProgress(0);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    // Show loading while checking for channel
    if (checkingChannel) {
        return (
            <div className="upload-page">
                <div className="upload-container">
                    <div className="loading">Checking your channel...</div>
                </div>
            </div>
        );
    }

    // Show prompt to create channel if user doesn't have one
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
                        message="You need to create a channel before you can upload videos. Channels help organize your content and let others discover your videos."
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
                <p className="upload-subtitle">Share your video with the world</p>

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
                            <p className="upload-hint">MP4, WebM, MOV up to 2GB</p>
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
                                    <p className="progress-text">{progress}% uploaded</p>
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
                                    Upload a custom thumbnail or one will be auto-generated from your video
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
