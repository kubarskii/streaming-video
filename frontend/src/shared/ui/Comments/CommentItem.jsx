import { useState } from 'react';
import { Avatar, Button } from '../index';
import { formatRelativeTime } from '../../lib';
import './Comments.css';

/**
 * CommentItem Component
 * Displays a single comment with edit/delete actions
 * 
 * @param {Object} props
 * @param {Object} props.comment - Comment object
 * @param {string} props.currentUserId - Current user ID
 * @param {Function} props.onUpdate - Callback when comment is updated
 * @param {Function} props.onDelete - Callback when comment is deleted
 */
export const CommentItem = ({ comment, currentUserId, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isOwner = currentUserId === comment.userId;

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editContent.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onUpdate(comment.id, editContent.trim());
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this comment?')) return;

        try {
            await onDelete(comment.id);
        } catch (error) {
            console.error('Failed to delete comment:', error);
        }
    };

    const handleCancel = () => {
        setEditContent(comment.content);
        setIsEditing(false);
    };

    return (
        <div className="comment-item">
            <Avatar name={comment.user?.username} size="medium" />
            <div className="comment-content">
                <div className="comment-header">
                    <span className="comment-author">{comment.user?.username || 'Unknown'}</span>
                    <span className="comment-time">{formatRelativeTime(comment.createdAt)}</span>
                    {comment.updatedAt !== comment.createdAt && (
                        <span className="comment-edited">(edited)</span>
                    )}
                </div>

                {isEditing ? (
                    <form onSubmit={handleUpdate} className="comment-edit-form">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="comment-edit-textarea"
                            rows="3"
                            disabled={isSubmitting}
                        />
                        <div className="comment-edit-actions">
                            <Button
                                type="submit"
                                size="small"
                                disabled={isSubmitting || !editContent.trim()}
                            >
                                {isSubmitting ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={handleCancel}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                ) : (
                    <>
                        <p className="comment-text">{comment.content}</p>
                        {isOwner && (
                            <div className="comment-actions">
                                <button
                                    className="comment-action-btn"
                                    onClick={() => setIsEditing(true)}
                                >
                                    Edit
                                </button>
                                <button
                                    className="comment-action-btn comment-action-btn--delete"
                                    onClick={handleDelete}
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

