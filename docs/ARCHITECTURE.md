# Architecture Documentation

## Service Boundaries

### Current Architecture (Monolithic Microservices)

The platform uses a **hybrid architecture** approach where services are separated by primary function, but some services handle multiple related domains for simplicity and efficiency.

#### Service Overview

1. **Gateway Service** (`services/gateway/`)
   - **Primary Responsibility**: Authentication, request routing, static file serving
   - **Port**: 3000 (default)
   - **Why**: Central entry point for all requests, handles auth once

2. **Upload Service** (`services/upload/`)
   - **Primary Responsibility**: Video uploads, video metadata CRUD, chunked uploads
   - **Secondary Responsibilities**: 
     - Channel management (channels belong to users who upload videos)
     - Playlist management (playlists contain videos)
     - Likes/Dislikes (interaction with videos)
     - Comments (discussion on videos)
     - Subscriptions (users subscribe to channels)
   - **Port**: 3001
   - **Why**: All video-related operations are co-located for:
     - Reduced network latency (single database transaction for video + metadata)
     - Simplified data consistency (no distributed transactions)
     - Easier development and debugging
     - Lower operational complexity

3. **Streaming Service** (`services/streaming/`)
   - **Primary Responsibility**: Video streaming, quality variants, view counting
   - **Port**: 3003
   - **Why**: Separated for scalability (can scale independently for high traffic)

4. **Worker Service** (`worker.js`)
   - **Primary Responsibility**: Background job processing (transcoding, thumbnails)
   - **Why**: CPU-intensive work separated from request handling

### Design Rationale

#### Why Upload Service Handles Multiple Domains

**Current Approach: Co-located Related Features**

The upload service handles channels, playlists, likes, comments, and subscriptions because:

1. **Data Locality**: All these features operate on the same core entities (videos, users, channels)
2. **Transaction Efficiency**: Many operations require atomic updates across multiple tables (e.g., deleting a video requires deleting comments, likes, playlist items)
3. **Development Velocity**: Easier to develop features that span multiple domains
4. **Operational Simplicity**: Fewer services to deploy, monitor, and maintain
5. **Performance**: No network hops between related operations

**Example**: When a user uploads a video:
- Video record created
- Channel video count incremented
- Thumbnail generated
- Transcoding job queued

All of this happens in one service with one database transaction, ensuring consistency.

#### When to Split Services

Consider splitting into separate services when:

1. **Scale Requirements**: A specific feature (e.g., comments) needs to scale independently
2. **Team Structure**: Different teams own different features
3. **Technology Requirements**: A feature needs different tech stack (e.g., real-time for comments)
4. **Deployment Frequency**: Different features need different deployment cadences
5. **Failure Isolation**: A feature's failures should not impact others

**Proposed Future Services** (if needed):

- `social-service`: Likes, comments, subscriptions (if real-time features needed)
- `channel-service`: Channel management (if channel features become complex)
- `playlist-service`: Playlist management (if playlist features become complex)

### Current Service Boundaries

```
┌─────────────────┐
│  Gateway (3000) │
│  - Auth         │
│  - Routing      │
│  - Static Files │
└────────┬────────┘
         │
    ┌────┴────┬──────────────┐
    │         │              │
┌───▼───┐ ┌──▼────┐ ┌───────▼────┐
│Upload │ │Stream │ │   Worker   │
│(3001) │ │(3003) │ │            │
│       │ │       │ │            │
│Video  │ │Stream │ │Transcoding │
│CRUD   │ │Video  │ │Thumbnails  │
│Upload │ │Views  │ │            │
│       │ │       │ │            │
│Channels│ │       │ │            │
│Playlists│       │ │            │
│Likes   │       │ │            │
│Comments│       │ │            │
│Subs    │       │ │            │
└───────┘ └───────┘ └────────────┘
```

### Database Connection Strategy

Each service uses a **singleton Prisma client** with service-specific connection pool limits:

- **Gateway**: 3 connections (light database usage)
- **Upload**: 5 connections (moderate usage, handles most CRUD)
- **Streaming**: 5 connections (moderate usage, read-heavy)
- **Worker**: 2 connections (background processing)

This prevents connection pool exhaustion while allowing each service to scale independently.

### Communication Patterns

1. **Gateway → Services**: HTTP proxy with user context headers
2. **Services → Database**: Direct Prisma connection
3. **Services → Storage**: Direct connection (B2 or local)
4. **Services → Queue**: Redis/BullMQ for background jobs
5. **Services → Cache**: Redis for distributed state (view counting)

### Future Considerations

If the platform grows, consider:

1. **Event-Driven Architecture**: Use message queue for cross-service communication
2. **API Gateway**: More sophisticated routing and rate limiting
3. **Service Mesh**: For service-to-service communication
4. **CQRS**: Separate read/write models for high-traffic features
5. **Database Per Service**: If strict service boundaries are needed

### Migration Path

If splitting services becomes necessary:

1. **Phase 1**: Extract to separate codebases, keep shared database
2. **Phase 2**: Add service-specific databases, use events for consistency
3. **Phase 3**: Implement proper service mesh and distributed tracing

---

**Last Updated**: 2024  
**Status**: Current architecture documented, no immediate plans to split services

