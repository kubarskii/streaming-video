# VideoCard Component

A comprehensive, reusable video card component for displaying video information with multiple layout variants.

## Features

- ✅ Multiple variants (grid, list, compact)
- ✅ Thumbnail with duration badge
- ✅ Video status indicators (processing, etc.)
- ✅ User avatar integration
- ✅ Responsive design
- ✅ Loading skeleton
- ✅ Grid layout container
- ✅ Accessibility support

## Usage

### Basic Video Card

```jsx
import { VideoCard } from '@/shared/ui';

const video = {
  id: '123',
  title: 'My Awesome Video',
  thumbnailUrl: 'https://...',
  durationMs: 180000, // 3 minutes
  views: 1234,
  uploadedAt: '2024-01-15T10:00:00Z',
  user: {
    username: 'johndoe',
  },
};

<VideoCard video={video} />
```

### With User Information

```jsx
<VideoCard 
  video={video} 
  showUser={true}
/>
```

### With Description

```jsx
<VideoCard 
  video={video} 
  showUser={true}
  showDescription={true}
/>
```

### List Variant (Horizontal Layout)

```jsx
<VideoCard 
  video={video} 
  variant="list"
  showUser={true}
  showDescription={true}
/>
```

### Compact Variant

```jsx
<VideoCard 
  video={video} 
  variant="compact"
/>
```

### Video Grid Container

```jsx
import { VideoCard, VideoCardGrid } from '@/shared/ui';

<VideoCardGrid columns="auto">
  {videos.map((video) => (
    <VideoCard key={video.id} video={video} showUser />
  ))}
</VideoCardGrid>
```

### Grid with Fixed Columns

```jsx
<VideoCardGrid columns="4">
  {videos.map((video) => (
    <VideoCard key={video.id} video={video} />
  ))}
</VideoCardGrid>
```

### Loading Skeleton

```jsx
import { VideoCardSkeleton, VideoCardGrid } from '@/shared/ui';

{loading ? (
  <VideoCardGrid columns="auto">
    <VideoCardSkeleton />
    <VideoCardSkeleton />
    <VideoCardSkeleton />
  </VideoCardGrid>
) : (
  <VideoCardGrid columns="auto">
    {videos.map((video) => (
      <VideoCard key={video.id} video={video} />
    ))}
  </VideoCardGrid>
)}
```

### Custom Click Handler

```jsx
<VideoCard 
  video={video} 
  onClick={(video) => {
    console.log('Video clicked:', video.id);
    // Custom navigation or action
  }}
/>
```

## Props

### VideoCard

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `video` | `Object` | **required** | Video object with metadata |
| `variant` | `'grid' \| 'list' \| 'compact'` | `'grid'` | Layout variant |
| `showUser` | `boolean` | `false` | Show user avatar and name |
| `showDescription` | `boolean` | `false` | Show video description |
| `onClick` | `function` | `undefined` | Custom click handler |
| `className` | `string` | `''` | Additional CSS classes |

### Video Object Structure

```typescript
{
  id: string | number;           // Required
  title: string;                 // Required
  thumbnailUrl?: string;         // Optional - shows placeholder if missing
  durationMs?: number;           // Optional - video duration in milliseconds
  views?: number;                // Optional - view count
  uploadedAt?: string;           // Optional - ISO date string
  description?: string;          // Optional - video description
  status?: string;               // Optional - 'processing', 'ready', etc.
  user?: {                       // Optional - uploader info
    username: string;
    name?: string;
  };
}
```

### VideoCardGrid

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | **required** | VideoCard components |
| `columns` | `'auto' \| '1' \| '2' \| '3' \| '4' \| '5'` | `'auto'` | Grid columns |
| `className` | `string` | `''` | Additional CSS classes |

### VideoCardSkeleton

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'grid' \| 'list' \| 'compact'` | `'grid'` | Layout variant to match |

## Variants

### Grid (Default)
- Vertical layout
- Thumbnail on top
- Perfect for home pages and browse sections
- Responsive grid layout

### List
- Horizontal layout on desktop
- Thumbnail on left
- More space for description
- Converts to vertical on mobile
- Great for search results

### Compact
- Minimal layout
- Smaller text and spacing
- Good for sidebars and "related videos"

## Examples

### Home Page Video Grid

```jsx
import { VideoCard, VideoCardGrid, Spinner } from '@/shared/ui';

export const HomePage = () => {
  const { videos, loading } = useVideos();

  if (loading) {
    return (
      <div className="page-container">
        <Spinner size="large" center />
      </div>
    );
  }

  return (
    <div className="page-container">
      <VideoCardGrid columns="auto">
        {videos.map((video) => (
          <VideoCard 
            key={video.id} 
            video={video}
            showUser={true}
          />
        ))}
      </VideoCardGrid>
    </div>
  );
};
```

### Search Results with List View

```jsx
import { VideoCard, EmptyState, SearchEmptyIcon } from '@/shared/ui';

export const SearchResults = ({ query, results }) => {
  if (results.length === 0) {
    return (
      <EmptyState
        icon={<SearchEmptyIcon />}
        title="No results found"
        description={`No videos match "${query}"`}
      />
    );
  }

  return (
    <div className="search-results">
      <h2>Results for "{query}"</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {results.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            variant="list"
            showUser={true}
            showDescription={true}
          />
        ))}
      </div>
    </div>
  );
};
```

### User Profile with Custom Grid

```jsx
import { VideoCard, VideoCardGrid, EmptyState, VideoEmptyIcon, Button } from '@/shared/ui';

export const UserVideos = ({ userId, videos }) => {
  if (videos.length === 0) {
    return (
      <EmptyState
        icon={<VideoEmptyIcon />}
        title="No videos yet"
        description="Upload your first video to get started"
        action={<Button variant="primary" href="/upload">Upload Video</Button>}
      />
    );
  }

  return (
    <VideoCardGrid columns="3">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          showDescription={true}
        />
      ))}
    </VideoCardGrid>
  );
};
```

### Related Videos Sidebar

```jsx
import { VideoCard } from '@/shared/ui';

export const RelatedVideos = ({ videos }) => {
  return (
    <aside className="related-videos">
      <h3>Related Videos</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            variant="compact"
          />
        ))}
      </div>
    </aside>
  );
};
```

### With Status Badges

```jsx
const processingVideo = {
  id: '123',
  title: 'Processing Video',
  status: 'processing',
  // ... other fields
};

<VideoCard video={processingVideo} />
// Shows yellow "processing" badge on thumbnail
```

## Responsive Behavior

### Desktop (>768px)
- Grid: 3-5 columns (depending on container width)
- List: Horizontal layout
- Compact: Side-by-side layout

### Tablet (768px - 480px)
- Grid: 2 columns
- List: Still horizontal
- Compact: Maintains layout

### Mobile (<480px)
- Grid: 1 column
- List: Vertical layout (thumbnail on top)
- Compact: Single column

## Accessibility

- ✅ Semantic HTML with proper heading hierarchy
- ✅ Alt text for thumbnails
- ✅ Keyboard navigation support
- ✅ Focus visible states
- ✅ ARIA labels where appropriate
- ✅ Screen reader friendly

## Styling

The component uses CSS custom properties that can be overridden:

```css
/* In your global styles or theme */
:root {
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
}
```

### Custom Styling

```jsx
<VideoCard
  video={video}
  className="my-custom-video-card"
/>
```

```css
.my-custom-video-card {
  /* Your custom styles */
  border: 2px solid #667eea;
}

.my-custom-video-card:hover {
  transform: scale(1.05);
}
```

## Integration with Formatting Utilities

The VideoCard uses shared formatting utilities from `@/shared/lib`:

```javascript
import { 
  formatViews,      // 1234 → "1.2K"
  formatDuration,   // 180000ms → "3:00"
  formatRelativeTime // ISO date → "2 hours ago"
} from '@/shared/lib';
```

These utilities are automatically used by VideoCard but can also be used independently in your components.

## Performance

- ✅ Lazy loading images with `loading="lazy"`
- ✅ Optimized CSS with minimal specificity
- ✅ No runtime CSS-in-JS overhead
- ✅ Efficient re-renders with React.memo (if needed)
- ✅ Skeleton loading for better perceived performance

## Best Practices

1. **Always provide video.id** - Required for React keys
2. **Use showUser on browse pages** - Helps users identify content creators
3. **Use list variant for search** - Better for scanning text-heavy results
4. **Use compact for sidebars** - Saves space while maintaining usability
5. **Show skeletons while loading** - Improves perceived performance
6. **Use VideoCardGrid** - Handles responsive layout automatically

## Migration from Old VideoCard

If you're using the old VideoCard from entities:

### Before
```jsx
import { VideoCard } from '../../entities/video/ui/VideoCard';

<VideoCard video={video} />
```

### After (Automatic!)
The old VideoCard now re-exports from shared, so no changes needed! But you can also import directly:

```jsx
import { VideoCard } from '@/shared/ui';

<VideoCard video={video} />
```

All existing usage will continue to work without any code changes! 🎉

