import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { commentsAPI } from '../../api/comments';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';
import { Button, Spinner, EmptyState } from '../index';
import './Comments.css';

/**
 * CommentsSection Component
 * Main component for displaying and managing comments on a video
 * 
 * @param {Object} props
 * @param {string} props.videoId - Video ID
 */
export const CommentsSection = ({ videoId }) => {
    const { user, isAuthenticated } = useAuth();
    const [comments, setComments] = useState([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [offset, setOffset] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);

    const LIMIT = 20;

    useEffect(() => {
        loadComments();
    }, [videoId]);

    const loadComments = async () => {
        try {
            setLoading(true);
            const data = await commentsAPI.getComments({
                videoId,
                limit: LIMIT,
                offset: 0
            });
            setComments(data.comments);
            setTotal(data.total);
            setHasMore(data.hasMore);
            setOffset(data.comments.length);
        } catch (error) {
            console.error('Failed to load comments:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMoreComments = async () => {
        try {
            setLoadingMore(true);
            const data = await commentsAPI.getComments({
                videoId,
                limit: LIMIT,
                offset
            });
            setComments(prev => [...prev, ...data.comments]);
            setTotal(data.total);
            setHasMore(data.hasMore);
            setOffset(prev => prev + data.comments.length);
        } catch (error) {
            console.error('Failed to load more comments:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleCreateComment = async (content) => {
        try {
            setIsSubmitting(true);
            const newComment = await commentsAPI.createComment({
                videoId,
                content
            });
            setComments(prev => [newComment, ...prev]);
            setTotal(prev => prev + 1);
        } catch (error) {
            console.error('Failed to create comment:', error);
            alert('Failed to post comment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateComment = async (commentId, content) => {
        try {
            const updatedComment = await commentsAPI.updateComment(commentId, { content });
            setComments(prev =>
                prev.map(c => c.id === commentId ? updatedComment : c)
            );
        } catch (error) {
            console.error('Failed to update comment:', error);
            alert('Failed to update comment. Please try again.');
            throw error;
        }
    };

    const handleDeleteComment = async (commentId) => {
        try {
            await commentsAPI.deleteComment(commentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
            setTotal(prev => prev - 1);
        } catch (error) {
            console.error('Failed to delete comment:', error);
            alert('Failed to delete comment. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="comments-section">
                <h2 className="comments-title">Comments</h2>
                <div className="comments-loading">
                    <Spinner size="medium" center />
                </div>
            </div>
        );
    }

    return (
        <div className="comments-section">
            <h2 className="comments-title">
                {total} {total === 1 ? 'Comment' : 'Comments'}
            </h2>

            {isAuthenticated ? (
                <CommentForm
                    onSubmit={handleCreateComment}
                    isSubmitting={isSubmitting}
                />
            ) : (
                <div className="comments-auth-prompt">
                    <p>Sign in to leave a comment</p>
                </div>
            )}

            <div className="comments-list">
                {comments.length === 0 ? (
                    <EmptyState
                        title="No comments yet"
                        description="Be the first to comment!"
                    />
                ) : (
                    <>
                        {comments.map(comment => (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                currentUserId={user?.id}
                                onUpdate={handleUpdateComment}
                                onDelete={handleDeleteComment}
                            />
                        ))}

                        {hasMore && (
                            <div className="comments-load-more">
                                <Button
                                    variant="secondary"
                                    onClick={loadMoreComments}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? 'Loading...' : 'Load More Comments'}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

