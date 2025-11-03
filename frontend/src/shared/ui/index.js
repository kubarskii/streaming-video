/**
 * Shared UI Components - Public API
 * 
 * This is the single entry point for all shared UI components.
 * Following FSD principles, only these exports are available to other layers.
 */

// Layout System
export { Container, Flex, FlexItem, Stack, Box, Section } from './Layout';

// Form Components
export { Button } from './Button';
export { Input } from './Input';
export { Textarea } from './Textarea';

// Feedback Components
export { Spinner } from './Spinner';
export { EmptyState, VideoEmptyIcon, SearchEmptyIcon } from './EmptyState';
export { ErrorState } from './ErrorState';
export {
    Skeleton,
    SkeletonText,
    ChannelHeaderSkeleton,
    TableRowSkeleton,
    PlaylistCardSkeleton,
    ChannelCardSkeleton,
    CommentSkeleton
} from './Skeleton';

// Data Display
export { Avatar, AvatarGroup } from './Avatar';
export { Card, CardHeader, CardBody, CardFooter } from './Card';
export { VideoCard, VideoCardGrid, VideoCardSkeleton } from './VideoCard';

// Overlay
export { Modal, ConfirmDialog } from './Modal';
export { BottomSheet } from './BottomSheet';

// Comments
export { CommentsSection, CommentForm, CommentItem } from './Comments';

// Video Player
export { VideoPlayer } from './VideoPlayer';

// Icons - Export all icons
export * from './Icons';

