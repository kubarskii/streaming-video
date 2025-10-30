// App: TanStack Router Configuration
import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import { Layout } from './Layout';
import { HomePage } from '../pages/home/HomePage';
import { VideoPage } from '../pages/video/VideoPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { UploadPageProtected } from '../pages/upload/UploadPageProtected';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { ChannelPage } from '../pages/channel/ChannelPage';
import { ChannelsListPage } from '../pages/channels/ChannelsListPage';
import { SubscriptionsPage } from '../pages/subscriptions/SubscriptionsPage';
import { PlaylistManagePage } from '../pages/playlist/PlaylistManagePage';

// Root route
const rootRoute = createRootRoute({
    component: Layout,
});

// Index route (Home)
const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomePage,
    validateSearch: (search) => {
        return {
            q: search?.q || undefined,
        };
    },
});

// Video route
const videoRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/video/$id',
    component: VideoPage,
});

// Login route
const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: LoginPage,
});

// Register route
const registerRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/register',
    component: RegisterPage,
});

// Upload route (protected)
const uploadRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/upload',
    component: UploadPageProtected,
});

// Profile route (protected)
const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/profile',
    component: ProfilePage,
});

// Channel route
const channelRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/channel/$userId',
    component: ChannelPage,
});

// Channels list route
const channelsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/channels',
    component: ChannelsListPage,
});

// Subscriptions route (protected)
const subscriptionsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/subscriptions',
    component: SubscriptionsPage,
});

// Playlist manage route (protected)
const playlistManageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/playlist/$playlistId/manage',
    component: PlaylistManagePage,
});

// Route tree
const routeTree = rootRoute.addChildren([
    indexRoute,
    videoRoute,
    loginRoute,
    registerRoute,
    uploadRoute,
    profileRoute,
    channelRoute,
    channelsRoute,
    subscriptionsRoute,
    playlistManageRoute,
]);

// Create router
export const router = createRouter({ routeTree });
