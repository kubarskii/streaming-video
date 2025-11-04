// App: TanStack Router Configuration
import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import { Layout } from './Layout';
import { HomePage } from '../pages/home/HomePage';
import { VideoPage } from '../pages/video/VideoPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { UploadPageProtected } from '../pages/upload/UploadPageProtected';
import { ProfileLayout } from '../pages/profile/ProfileLayout';
import { ProfileVideosPage } from '../pages/profile/ProfileVideosPage';
import { ProfilePlaylistsPage } from '../pages/profile/ProfilePlaylistsPage';
import { ProfileChannelPage } from '../pages/profile/ProfileChannelPage';
import { VideoEditPage } from '../pages/profile/VideoEditPage';
import { ChannelLayout } from '../pages/channel/ChannelLayout';
import { ChannelVideosPage } from '../pages/channel/ChannelVideosPage';
import { ChannelPlaylistsPage } from '../pages/channel/ChannelPlaylistsPage';
import { ChannelsListPage } from '../pages/channels/ChannelsListPage';
import { SubscriptionsPage } from '../pages/subscriptions/SubscriptionsPage';
import { PlaylistManagePage } from '../pages/playlist/PlaylistManagePage';
import { PlaylistViewPage } from '../pages/playlist/PlaylistViewPage';

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

// Profile routes (protected) - with nested routes for separate pages
const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/profile',
    component: ProfileLayout,
});

const profileVideosRoute = createRoute({
    getParentRoute: () => profileRoute,
    path: '/',
    component: ProfileVideosPage,
});

const profilePlaylistsRoute = createRoute({
    getParentRoute: () => profileRoute,
    path: '/playlists',
    component: ProfilePlaylistsPage,
});

const profileChannelRoute = createRoute({
    getParentRoute: () => profileRoute,
    path: '/channel',
    component: ProfileChannelPage,
});

const profileVideoEditRoute = createRoute({
    getParentRoute: () => profileRoute,
    path: '/videos/$videoId/edit',
    component: VideoEditPage,
});

// Channel routes - with nested routes for separate pages
const channelRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/channel/$userId',
    component: ChannelLayout,
});

const channelVideosRoute = createRoute({
    getParentRoute: () => channelRoute,
    path: '/',
    component: ChannelVideosPage,
});

const channelPlaylistsRoute = createRoute({
    getParentRoute: () => channelRoute,
    path: '/playlists',
    component: ChannelPlaylistsPage,
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

// Playlist view route (public)
const playlistViewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/playlist/$playlistId',
    component: PlaylistViewPage,
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
    profileRoute.addChildren([
        profileVideosRoute,
        profilePlaylistsRoute,
        profileChannelRoute,
        profileVideoEditRoute,
    ]),
    channelRoute.addChildren([
        channelVideosRoute,
        channelPlaylistsRoute,
    ]),
    channelsRoute,
    subscriptionsRoute,
    playlistViewRoute,
    playlistManageRoute,
]);

// Create router
export const router = createRouter({ routeTree });
