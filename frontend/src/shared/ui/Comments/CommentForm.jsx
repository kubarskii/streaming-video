import { useState } from 'react';
import { Button } from '../index';
import './Comments.css';

/**
 * CommentForm Component
 * Form for creating a new comment
 * 
 * @param {Object} props
 * @param {Function} props.onSubmit - Callback when form is submitted
 * @param {boolean} props.isSubmitting - Whether form is currently submitting
 */
export const CommentForm = ({ onSubmit, isSubmitting }) => {
    const [content, setContent] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim() || isSubmitting) return;

        await onSubmit(content.trim());
        setContent('');
    };

    return (
        <form onSubmit={handleSubmit} className="comment-form">
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Add a comment..."
                className="comment-form-textarea"
                rows="3"
                disabled={isSubmitting}
                maxLength={5000}
            />
            <div className="comment-form-actions">
                <span className="comment-form-count">
                    {content.length}/5000
                </span>
                <Button
                    type="submit"
                    disabled={isSubmitting || !content.trim()}
                    size="small"
                >
                    {isSubmitting ? 'Posting...' : 'Comment'}
                </Button>
            </div>
        </form>
    );
};

