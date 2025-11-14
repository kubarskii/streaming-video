// @ts-nocheck
/**
 * @fileoverview Infrastructure Layer - Validation Schemas
 * @module infrastructure/validation/schemas
 * @description Enterprise-grade validation schemas using Zod for all API endpoints.
 * This module follows DDD principles by keeping validation logic in the infrastructure layer,
 * separate from domain business rules. Schemas validate data structure and format,
 * while domain entities enforce business invariants.
 */

const { z } = require('zod');

// ============================================================================
// Common/Shared Schemas
// ============================================================================

/**
 * UUID validation schema
 * @type {import('zod').ZodString}
 * @description Validates that a string is a valid UUID v4
 * @example
 * // Valid: "123e4567-e89b-12d3-a456-426614174000"
 * // Invalid: "not-a-uuid", "123", ""
 */
const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

/**
 * Pagination parameters schema
 * @type {import('zod').ZodObject}
 * @description Standard pagination with limit and offset
 * @property {number} limit - Number of items per page (1-100, default: 20)
 * @property {number} offset - Number of items to skip (min: 0, default: 0)
 */
const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0)
});

/**
 * File upload metadata schema
 * @type {import('zod').ZodObject}
 * @description Validates uploaded file metadata from multipart/form-data
 * @property {string} filepath - Temporary file path on server
 * @property {string} originalFilename - Original filename from client
 * @property {string} mimetype - MIME type of the file
 * @property {number} size - File size in bytes (must be positive)
 */
const fileSchema = z.object({
    filepath: z.string(),
    originalFilename: z.string(),
    mimetype: z.string(),
    size: z.number().positive()
});

// ============================================================================
// Auth Schemas
// ============================================================================

/**
 * User registration schema
 * @type {import('zod').ZodObject}
 * @description Validates user registration payload with enterprise-grade password requirements
 * @property {string} email - Valid email address (3-255 chars, lowercase, trimmed)
 * @property {string} username - Alphanumeric username (3-50 chars, a-z A-Z 0-9 _ -)
 * @property {string} password - Strong password (8-128 chars, must contain: lowercase, uppercase, number, special char)
 * @throws {ZodError} If validation fails with detailed error messages
 * @example
 * // Valid payload:
 * {
 *   email: "user@example.com",
 *   username: "john_doe",
 *   password: "SecureP@ss123"
 * }
 */
const registerSchema = z.object({
    email: z.string()
        .email({ message: 'Invalid email address' })
        .min(3, 'Email must be at least 3 characters')
        .max(255, 'Email must be at most 255 characters')
        .toLowerCase()
        .trim(),

    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be at most 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
        .trim(),

    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')
});

/**
 * User login schema
 * @type {import('zod').ZodObject}
 * @description Validates user login credentials
 * @property {string} emailOrUsername - Email address or username (lowercase, trimmed)
 * @property {string} password - User password (required)
 * @throws {ZodError} If validation fails
 * @example
 * // Valid payload:
 * {
 *   emailOrUsername: "user@example.com",
 *   password: "SecureP@ss123"
 * }
 * // Or with username:
 * {
 *   emailOrUsername: "john_doe",
 *   password: "SecureP@ss123"
 * }
 */
const loginSchema = z.object({
    emailOrUsername: z.string()
        .min(1, 'Email or username is required')
        .toLowerCase()
        .trim(),

    password: z.string()
        .min(1, 'Password is required')
});

// ============================================================================
// Video Schemas
// ============================================================================

/**
 * Video title validation schema
 * @type {import('zod').ZodString}
 * @description Validates video title (1-200 characters, trimmed)
 */
const videoTitleSchema = z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .trim();

/**
 * Video description validation schema
 * @description Validates video description (max 5000 characters, optional)
 */
const videoDescriptionSchema = z.string()
    .max(5000, 'Description must be at most 5000 characters')
    .optional()
    .nullable();

/**
 * Video status enum schema
 * @description Validates video processing status
 * @enum {string} pending - Video uploaded, not yet processed
 * @enum {string} processing - Currently being transcoded
 * @enum {string} ready - Ready for playback
 * @enum {string} failed - Processing failed
 */
// @ts-ignore - False positive duplicate declaration error
const videoStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);

/**
 * Video MIME type validation schema
 * @description Validates that uploaded file is a supported video format
 * @supported MP4, MOV, AVI, WebM, MKV
 * @note For best browser compatibility, videos are transcoded to MP4 (H.264)
 * @browserSupport
 *   - MP4 (H.264): ✅ All browsers (recommended)
 *   - WebM: ✅ Chrome, Firefox, Opera, Edge
 *   - MOV: ⚠️ Safari only (auto-converted to MP4)
 *   - AVI: ❌ Limited browser support (auto-converted to MP4/WebM)
 *   - MKV: ❌ Very limited support (auto-converted to MP4/WebM)
 */
const videoMimeTypeSchema = z.string()
    .regex(/^video\//, 'Must be a video file')
    .refine(
        (mime) => [
            'video/mp4', 
            'video/quicktime', 
            'video/x-msvideo',  // AVI (standard)
            'video/avi',        // AVI (alternative)
            'video/msvideo',    // AVI (older)
            'video/webm', 
            'video/x-matroska', 
            'video/mkv'
        ].includes(mime),
        'Unsupported video format. Supported: MP4, MOV, AVI, WebM, MKV'
    );

const updateVideoMetadataSchema = z.object({
    title: videoTitleSchema.optional(),
    description: videoDescriptionSchema
}).refine(
    (data) => data.title !== undefined || data.description !== undefined,
    { message: 'At least one field (title or description) must be provided' }
);

const uploadVideoSchema = z.object({
    title: videoTitleSchema,
    description: videoDescriptionSchema,
    video: fileSchema.extend({
        mimetype: videoMimeTypeSchema,
        size: z.number()
            .min(1024, 'Video file is too small (min 1KB)')
            .max(5 * 1024 * 1024 * 1024, 'Video file is too large (max 5GB)')
    }),
    thumbnail: fileSchema.extend({
        mimetype: z.string()
            .regex(/^image\//, 'Thumbnail must be an image')
            .refine(
                (mime) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(mime),
                'Unsupported image format. Supported: JPG, PNG, WebP, GIF'
            ),
        size: z.number()
            .max(10 * 1024 * 1024, 'Thumbnail is too large (max 10MB)')
    }).optional()
});

const listVideosQuerySchema = paginationSchema.extend({
    status: videoStatusSchema.optional(),
    userId: uuidSchema.optional(),
    search: z.string().max(200).optional()
});

// ============================================================================
// Channel Schemas
// ============================================================================

const channelNameSchema = z.string()
    .min(3, 'Channel name must be at least 3 characters')
    .max(100, 'Channel name must be at most 100 characters')
    .regex(/^[a-zA-Z0-9\s_-]+$/, 'Channel name can only contain letters, numbers, spaces, underscores, and hyphens')
    .trim();

const channelDescriptionSchema = z.string()
    .max(2000, 'Description must be at most 2000 characters')
    .optional()
    .nullable();

const createChannelSchema = z.object({
    name: channelNameSchema,
    description: channelDescriptionSchema
});

const updateChannelSchema = z.object({
    name: channelNameSchema.optional(),
    description: channelDescriptionSchema,
    avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
    bannerUrl: z.string().url('Invalid banner URL').optional().nullable()
}).refine(
    (data) => Object.keys(data).some(key => data[key] !== undefined),
    { message: 'At least one field must be provided for update' }
);

const getChannelQuerySchema = z.object({
    userId: uuidSchema.optional(),
    channelId: uuidSchema.optional()
}).refine(
    (data) => data.userId || data.channelId,
    { message: 'Either userId or channelId must be provided' }
);

const listChannelsQuerySchema = paginationSchema.extend({
    search: z.string().max(200).optional(),
    sortBy: z.enum(['subscriberCount', 'videoCount', 'createdAt']).optional()
});

// ============================================================================
// Comment Schemas
// ============================================================================

const commentContentSchema = z.string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be at most 2000 characters')
    .trim();

const createCommentSchema = z.object({
    videoId: uuidSchema,
    content: commentContentSchema
});

const updateCommentSchema = z.object({
    content: commentContentSchema
});

const getCommentsQuerySchema = z.object({
    videoId: uuidSchema,
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0)
});

// ============================================================================
// Subscription Schemas
// ============================================================================

const subscribeSchema = z.object({
    channelId: uuidSchema
});

const getSubscriptionsQuerySchema = z.object({
    userId: uuidSchema.optional()
});

// ============================================================================
// Playlist Schemas
// ============================================================================

const playlistTitleSchema = z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .trim();

const playlistDescriptionSchema = z.string()
    .max(5000, 'Description must be at most 5000 characters')
    .optional()
    .nullable();

const playlistSlugSchema = z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(100, 'Slug must be at most 100 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional()
    .nullable();

const createPlaylistSchema = z.object({
    title: playlistTitleSchema,
    description: playlistDescriptionSchema,
    isPublic: z.boolean().optional(),
    slug: playlistSlugSchema,
    videoIds: z.array(uuidSchema).optional()
});

const updatePlaylistSchema = z.object({
    title: playlistTitleSchema.optional(),
    description: playlistDescriptionSchema,
    isPublic: z.boolean().optional(),
    slug: playlistSlugSchema
}).refine(
    (data) => data.title !== undefined || data.description !== undefined || data.isPublic !== undefined || data.slug !== undefined,
    { message: 'At least one field must be provided' }
);

const listPlaylistsQuerySchema = paginationSchema.extend({
    userId: uuidSchema.optional(),
    isPublic: z.coerce.boolean().optional(),
    search: z.string().max(200, 'Search must be at most 200 characters').optional(),
    includeVideos: z.coerce.boolean().optional()
});

const addVideoToPlaylistSchema = z.object({
    videoId: uuidSchema,
    position: z.coerce.number().int().min(0).optional()
});

const reorderPlaylistVideosSchema = z.object({
    videoIds: z.array(uuidSchema).min(1, 'At least one video id is required')
});

// ============================================================================
// Quality/Transcode Schemas
// ============================================================================

const qualityLevelSchema = z.enum(['360p', '480p', '720p', '1080p', 'original']);

// ============================================================================
// Export all schemas
// ============================================================================

/**
 * @exports ValidationSchemas
 * @description All validation schemas for the application
 * @namespace ValidationSchemas
 * @remarks
 * These schemas are part of the Infrastructure layer in DDD architecture.
 * They validate data structure and format before it reaches the Application layer.
 * Domain entities should still enforce their own business invariants.
 * 
 * Usage pattern:
 * 1. Infrastructure layer: Validate incoming data structure (this module)
 * 2. Application layer: Use cases orchestrate operations
 * 3. Domain layer: Entities enforce business rules and invariants
 */
module.exports = {
    // Common
    uuidSchema,
    paginationSchema,

    // Auth
    registerSchema,
    loginSchema,

    // Video
    updateVideoMetadataSchema,
    uploadVideoSchema,
    listVideosQuerySchema,
    videoStatusSchema,

    // Channel
    createChannelSchema,
    updateChannelSchema,
    getChannelQuerySchema,
    listChannelsQuerySchema,

    // Comment
    createCommentSchema,
    updateCommentSchema,
    getCommentsQuerySchema,

    // Subscription
    subscribeSchema,
    getSubscriptionsQuerySchema,

    // Playlists
    createPlaylistSchema,
    updatePlaylistSchema,
    listPlaylistsQuerySchema,
    addVideoToPlaylistSchema,
    reorderPlaylistVideosSchema,

    // Quality
    qualityLevelSchema
};

