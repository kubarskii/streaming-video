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
            setError(error.message || 'Upload failed. Please try again.');
            setUploading(false);
        }
    };

    const handleSimpleUpload = async (startTime) => {
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

                // Calculate upload speed using file size
                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed > 0 && file.size) {
                    // Estimate loaded bytes from progress
                    const estimatedLoaded = (progressPercent / 100) * file.size;
                    const speed = estimatedLoaded / elapsed;
                    setUploadSpeed(speed);
                } else {
                    setUploadSpeed(0);
                }
            },
            file.size
        );

        console.log('Simple upload complete!', result);
        navigate({ to: `/video/${result.video.id}` });
    };

    const handleChunkedUpload = async (startTime) => {
        // Create uploader instance
        const uploader = new ChunkedUploader({
            chunkSize: 5 * 1024 * 1024, // 5MB chunks
            maxConcurrent: 3, // 3 parallel uploads
            maxRetries: 3,
            onProgress: (progressPercent, uploadedBytes, totalBytes) => {
                setProgress(Math.round(progressPercent));

                // Calculate upload speed
                const elapsed = (Date.now() - startTime) / 1000;
                const speed = uploadedBytes / elapsed;
                setUploadSpeed(speed);
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

        // Start upload
        const result = await uploader.upload(file, {
            title,
            description,
            thumbnail,
        });

        console.log('Chunked upload complete!', result);
        navigate({ to: `/video/${result.video.id}` });
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
        if (!bytesPerSecond) return '0 KB/s';
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

