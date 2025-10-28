/**
 * Shared UI Components - Public API
 * 
 * This is the single entry point for all shared UI components.
 * Following FSD principles, only these exports are available to other layers.
 */

// Form Components
export { Button } from './Button';
export { Input } from './Input';
export { Textarea } from './Textarea';

// Feedback Components
export { Spinner, FullPageSpinner } from './Spinner';
export { EmptyState, VideoEmptyIcon, SearchEmptyIcon } from './EmptyState';
export { ErrorState } from './ErrorState';

// Data Display
export { Avatar, AvatarGroup } from './Avatar';
export { Card, CardHeader, CardBody, CardFooter } from './Card';
export { VideoCard, VideoCardGrid, VideoCardSkeleton } from './VideoCard';
export { ProfileVideoCard, ProfileVideoGrid } from './ProfileVideoCard';

// Overlay
export { Modal, ConfirmDialog } from './Modal';

// Icons - Export all icons
export * from './Icons';

