import { useState } from 'react';
import { Avatar } from '../index';
import './Comments.css';

/**
 * CommentForm Component
 * Form for creating a new comment
 * 
 * @param {Object} props
 * @param {Function} props.onSubmit - Callback when form is submitted
 * @param {boolean} props.isSubmitting - Whether form is currently submitting
 * @param {Object} props.user - Current user object with username
 */
export const CommentForm = ({ onSubmit, isSubmitting, user }) => {
    const [content, setContent] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim() || isSubmitting) return;

        await onSubmit(content.trim());
        setContent('');
        setIsFocused(false);
    };

    const handleCancel = () => {
        setContent('');
        setIsFocused(false);
    };

    return (
        <form onSubmit={handleSubmit} className="comment-form">
            <div className="comment-form-container">
                <Avatar name={user?.username} size="medium" />
                <div className="comment-form-input-wrapper">
                    <div className="comment-form-input-container">
                        <input
                            type="text"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            placeholder="Add a comment..."
                            className="comment-form-input"
                            disabled={isSubmitting}
                            maxLength={5000}
                        />
                    </div>
                    {isFocused && (
                        <div className="comment-form-actions">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="comment-form-cancel"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !content.trim()}
                                className="comment-form-submit"
                            >
                                {isSubmitting ? 'Posting...' : 'Comment'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </form>
    );
};

