# Channels and Subscriptions Feature

## Overview
This implementation adds a complete channels and subscriptions system to your video platform, allowing users to create channels, subscribe to other channels, and discover content creators.

## Database Schema

### New Models
- **Channel**: Represents a user's channel with metadata (name, description, avatar, banner, subscriber count, video count)
- **Subscription**: Represents a user's subscription to a channel

### Relationships
- One User → One Channel (1:1)
- One User → Many Subscriptions (1:N)
- One Channel → Many Subscriptions (1:N)

## Backend Implementation

### Domain Layer
- **Entities**: `Channel.js`, `Subscription.js`
- **Repository Interfaces**: `IChannelRepository.js`, `ISubscriptionRepository.js`
- **Repository Implementations**: `PrismaChannelRepository.js`, `PrismaSubscriptionRepository.js`

### Application Layer (Use Cases)
- `CreateChannelUseCase` - Create a new channel
- `GetChannelUseCase` - Get channel by ID or user ID
- `UpdateChannelUseCase` - Update channel information
- `ListChannelsUseCase` - List all channels with pagination and sorting
- `SubscribeToChannelUseCase` - Subscribe to a channel
- `UnsubscribeFromChannelUseCase` - Unsubscribe from a channel
- `GetUserSubscriptionsUseCase` - Get user's subscriptions
- `CheckSubscriptionStatusUseCase` - Check if user is subscribed

### Presentation Layer
- **Controllers**: `ChannelController.js`, `SubscriptionController.js`
- **Routes Added**:
  - `POST /api/channels` - Create channel
  - `GET /api/channels?userId={userId}` - Get channel by user ID
  - `GET /api/channels?channelId={channelId}` - Get channel by ID
  - `PATCH /api/channels/:id` - Update channel
  - `GET /api/channels/list` - List all channels
  - `POST /api/subscriptions` - Subscribe to channel
  - `DELETE /api/subscriptions/:channelId` - Unsubscribe from channel
  - `GET /api/subscriptions` - Get user's subscriptions
  - `GET /api/subscriptions/:channelId/status` - Check subscription status

## Frontend Implementation

### API Clients
- `frontend/src/shared/api/channels.js` - Channel API methods
- `frontend/src/shared/api/subscriptions.js` - Subscription API methods

### Pages
1. **Channel Page** (`/channel/:userId`)
   - View channel information
   - Subscribe/unsubscribe button
   - View channel's videos
   - Channel banner and avatar

2. **Channels List Page** (`/channels`)
   - Browse all channels
   - Sort by subscribers, videos, or newest
   - Click to view channel

3. **Subscriptions Page** (`/subscriptions`)
   - View user's subscribed channels
   - Unsubscribe from channels
   - Navigate to channel pages

4. **Profile Page** (Enhanced)
   - Create channel
   - Edit channel information
   - View subscriber count
   - Link to public channel view

### UI Updates
- **VideoCard**: Now links to channel when showing user information
- **VideoPage**: Added "View Channel" link
- **Navigation**: Added "Channels" and "Subscriptions" links in header

## Features

### Channel Management
- Users can create one channel per account
- Channel info includes: name, description, avatar, banner
- Subscriber and video counts are automatically maintained
- Public channel pages show all videos from that creator
- **Videos can only be uploaded by users with a channel**
- Video count automatically increments/decrements on upload/delete

### Subscription System
- Users can subscribe to any channel (except their own)
- Subscription status is tracked per user-channel pair
- Subscriber counts update automatically on subscribe/unsubscribe
- Users can view all their subscriptions in one place

### Discovery
- Browse channels page with sorting options:
  - Most subscribers
  - Most videos
  - Newest channels
- Video cards link to channel pages
- Channel pages show all videos from that creator

## Usage

### Creating a Channel (Required for Uploading)
1. Log in to your account
2. Go to Profile page
3. Click "Create Channel"
4. Fill in channel name and description
5. Click "Create"

**Note**: You must create a channel before you can upload videos. If you try to access the upload page without a channel, you'll be prompted to create one first.

### Subscribing to a Channel
1. Browse channels or click on a user's channel link
2. Click "Subscribe" button
3. View your subscriptions in the Subscriptions page

### Managing Your Channel
1. Go to Profile page
2. Edit channel information
3. Click "View Public Channel" to see how others see your channel

## Technical Notes

### Authentication
- All subscription and channel management endpoints require authentication
- Channels are tied to user accounts
- Users can only edit their own channels

### Data Integrity
- Unique constraint on userId-channelId for subscriptions (no duplicate subscriptions)
- Cascade delete: deleting a user deletes their channel and subscriptions
- Atomic operations for subscriber count updates

### Performance
- Indexed fields: userId, channelId, subscriberCount
- Pagination support for channels and subscriptions lists
- Efficient queries with Prisma includes

## Future Enhancements (Optional)
- Channel avatars and banners upload
- Video notifications for subscribed channels
- Channel analytics and statistics
- Featured channels
- Channel categories/tags
- Channel verification badges

