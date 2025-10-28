import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button, Input, Textarea, Modal, ConfirmDialog } from './index';
import { EditIcon, EyeIcon, DeleteIcon, UploadIcon, CheckIcon, CloseIcon } from './Icons';
import { formatDate } from '../lib';
import './ProfileVideoCard.css';

/**
 * Profile Video Card - Enhanced video card for profile/management pages
 * 
 * Features:
 * - Inline editing (title, description)
 * - Thumbnail upload with overlay button
 * - Action buttons (edit, view, delete)
 * - File size and upload date
 * - Confirmation dialogs
 */
export const ProfileVideoCard = ({
    video,
    onUpdate,
    onDelete,
    onThumbnailUpdate,
    onView,
    className = '',
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        title: video.title,
        description: video.description || '',
    });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
    const [saving, setSaving] = useState(false);

    const cardClasses = [
        'ui-profile-video-card',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const handleEdit = () => {
        setIsEditing(true);
        setEditForm({
            title: video.title,
            description: video.description || '',
        });
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditForm({
            title: video.title,
            description: video.description || '',
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onUpdate?.(video.id, editForm);
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        await onDelete?.(video.id);
        setShowDeleteConfirm(false);
    };

    const handleThumbnailChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        setUploadingThumbnail(true);
        try {
            await onThumbnailUpdate?.(video.id, file);
        } catch (error) {
            console.error('Failed to update thumbnail:', error);
            alert('Failed to update thumbnail');
        } finally {
            setUploadingThumbnail(false);
        }
    };

    const handleView = () => {
        if (onView) {
            onView(video);
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };

    return (
        <>
            <div className={cardClasses}>
                {/* Thumbnail with overlay button */}
                <div className="ui-profile-video-card__thumbnail">
                    <img
                        src={video.thumbnailUrl || '/placeholder-thumbnail.jpg'}
                        alt={video.title}
                        className="ui-profile-video-card__image"
                    />
                    <div className="ui-profile-video-card__thumbnail-overlay">
                        <label
                            htmlFor={`thumbnail-${video.id}`}
                            className="ui-profile-video-card__thumbnail-btn"
                            title="Change thumbnail"
                        >
                            {uploadingThumbnail ? (
                                <span className="ui-profile-video-card__spinner" />
                            ) : (
                                <UploadIcon size={20} />
                            )}
                        </label>
                        <input
                            id={`thumbnail-${video.id}`}
                            type="file"
                            accept="image/*"
                            onChange={handleThumbnailChange}
                            style={{ display: 'none' }}
                            disabled={uploadingThumbnail}
                        />
                    </div>
                    {video.status && video.status !== 'ready' && (
                        <div className="ui-profile-video-card__status">{video.status}</div>
                    )}
                </div>

                {/* Content */}
                <div className="ui-profile-video-card__content">
                    {isEditing ? (
                        <div className="ui-profile-video-card__edit-form">
                            <Input
                                value={editForm.title}
                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                placeholder="Video title"
                                fullWidth
                            />
                            <Textarea
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                placeholder="Description"
                                rows={3}
                                fullWidth
                            />
                            <div className="ui-profile-video-card__edit-actions">
                                <Button
                                    variant="primary"
                                    size="small"
                                    onClick={handleSave}
                                    loading={saving}
                                    icon={<CheckIcon size={16} />}
                                >
                                    Save
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={handleCancel}
                                    disabled={saving}
                                    icon={<CloseIcon size={16} />}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Link to={`/video/${video.id}`} className="ui-profile-video-card__title">
                                {video.title}
                            </Link>
                            {video.description && (
                                <p className="ui-profile-video-card__description">{video.description}</p>
                            )}
                            <div className="ui-profile-video-card__meta">
                                {video.sizeBytes && <span>{formatFileSize(video.sizeBytes)}</span>}
                                {video.uploadedAt && (
                                    <>
                                        <span>•</span>
                                        <span>{formatDate(video.uploadedAt)}</span>
                                    </>
                                )}
                                {video.views !== undefined && (
                                    <>
                                        <span>•</span>
                                        <span>{video.views} views</span>
                                    </>
                                )}
                            </div>
                            <div className="ui-profile-video-card__actions">
                                <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={handleEdit}
                                    icon={<EditIcon size={16} />}
                                >
                                    Edit
                                </Button>
                                {onView && (
                                    <Button
                                        variant="primary"
                                        size="small"
                                        onClick={handleView}
                                        icon={<EyeIcon size={16} />}
                                    >
                                        View
                                    </Button>
                                )}
                                <Button
                                    variant="danger"
                                    size="small"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    icon={<DeleteIcon size={16} />}
                                >
                                    Delete
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Delete Video"
                message={`Are you sure you want to delete "${video.title}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />
        </>
    );
};

/**
 * Profile Video Grid - Container for profile video cards
 */
export const ProfileVideoGrid = ({ children, className = '' }) => {
    return (
        <div className={`ui-profile-video-grid ${className}`}>
            {children}
        </div>
    );
};

