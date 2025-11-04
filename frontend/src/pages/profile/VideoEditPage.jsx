// Video Edit Page - Edit video details
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../shared/context/AuthContext';
import { videosAPI } from '../../shared/api/videos';
import { Button, Spinner, UploadIcon } from '../../shared/ui';
import styles from './ProfilePage.module.css';

export const VideoEditPage = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { videoId } = useParams({ strict: false });
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
    const [video, setVideo] = useState(null);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        description: ''
    });

    const [thumbnailPreview, setThumbnailPreview] = useState(null);

    useEffect(() => {
        loadVideo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    const loadVideo = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await videosAPI.getVideo(videoId);

            // Check if user owns this video
            if (data.userId !== user.id) {
                setError('You do not have permission to edit this video');
                return;
            }

            setVideo(data);
            setFormData({
                title: data.title || '',
                description: data.description || ''
            });
            setThumbnailPreview(data.thumbnailUrl);
        } catch (err) {
            console.error('Error loading video:', err);
            setError('Failed to load video');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            alert('Title is required');
            return;
        }

        try {
            setSaving(true);
            await videosAPI.updateVideoMetadata(videoId, {
                title: formData.title.trim(),
                description: formData.description.trim()
            });

            // Refetch video data to show updated information
            const updatedVideo = await videosAPI.getVideo(videoId);
            setVideo(updatedVideo);
            setFormData({
                title: updatedVideo.title || '',
                description: updatedVideo.description || ''
            });
            setThumbnailPreview(updatedVideo.thumbnailUrl);
        } catch (err) {
            console.error('Error updating video:', err);
            alert('Failed to update video: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        navigate({ to: '/profile/videos' });
    };

    const handleThumbnailChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB');
            return;
        }

        try {
            setUploadingThumbnail(true);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setThumbnailPreview(reader.result);
            };
            reader.readAsDataURL(file);

            // Upload thumbnail
            await videosAPI.updateVideoThumbnail(videoId, file);

            // Reload video data to get updated thumbnail URL
            const updatedVideo = await videosAPI.getVideo(videoId);
            setVideo(updatedVideo);
            setThumbnailPreview(updatedVideo.thumbnailUrl);
        } catch (err) {
            console.error('Error uploading thumbnail:', err);
            alert('Failed to upload thumbnail: ' + err.message);
            // Reset preview to original
            setThumbnailPreview(video?.thumbnailUrl);
        } finally {
            setUploadingThumbnail(false);
        }
    };

    if (loading) {
        return (
            <div className={styles['studio-tab-content']}>
                <div className={styles['loading-container']}>
                    <Spinner size="large" center />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles['studio-tab-content']}>
                <div className={styles['error-container']}>
                    <h2>{t('errors.something_went_wrong')}</h2>
                    <p>{error}</p>
                    <Button variant="primary" onClick={() => navigate({ to: '/profile/videos' })}>
                        {t('common.back')}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles['studio-tab-content']}>
            <div className={styles['studio-header']}>
                <div>
                    <h1>Edit Video</h1>
                    <p className={styles['studio-subtitle']}>Update your video details</p>
                </div>
            </div>

            <div className={styles['video-edit-container']}>
                <div className={styles['video-edit-main']}>
                    <form onSubmit={handleSubmit} className={styles['video-edit-form']}>
                        <div className={styles['form-section']}>
                            <h3>Thumbnail</h3>
                            <div className={styles['thumbnail-upload-section']}>
                                <div className={styles['thumbnail-preview']}>
                                    <img
                                        src={thumbnailPreview || video?.thumbnailUrl || '/placeholder-video.png'}
                                        alt="Thumbnail preview"
                                    />
                                    {uploadingThumbnail && (
                                        <div className={styles['thumbnail-uploading-overlay']}>
                                            <Spinner size="medium" />
                                            <span>Uploading...</span>
                                        </div>
                                    )}
                                </div>
                                <div className={styles['thumbnail-upload-info']}>
                                    <p className={styles['thumbnail-hint']}>
                                        Choose a thumbnail that stands out and draws viewers' attention.
                                    </p>
                                    <label className={styles['thumbnail-upload-button']}>
                                        <UploadIcon size={16} />
                                        <span>Upload thumbnail</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleThumbnailChange}
                                            disabled={uploadingThumbnail}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                    <p className={styles['thumbnail-requirements']}>
                                        JPG, PNG, or GIF. Max 5MB. Recommended: 1280x720px (16:9)
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className={styles['form-section']}>
                            <h3>Details</h3>

                            <div className={styles['form-group']}>
                                <label htmlFor="title" className={styles['form-label']}>
                                    Title (required)
                                </label>
                                <input
                                    type="text"
                                    id="title"
                                    className={styles['form-input']}
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Add a title that describes your video"
                                    required
                                    maxLength={100}
                                />
                                <div className={styles['form-hint']}>
                                    {formData.title.length}/100
                                </div>
                            </div>

                            <div className={styles['form-group']}>
                                <label htmlFor="description" className={styles['form-label']}>
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    className={styles['form-textarea']}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Tell viewers about your video"
                                    rows={6}
                                    maxLength={5000}
                                />
                                <div className={styles['form-hint']}>
                                    {formData.description.length}/5000
                                </div>
                            </div>
                        </div>

                        <div className={styles['form-actions']}>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={saving || !formData.title.trim()}
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleCancel}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </div>

                <div className={styles['video-edit-sidebar']}>

                </div>
            </div>
        </div>
    );
};

