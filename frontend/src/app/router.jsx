// App: TanStack Router Configuration
import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import { Layout } from './Layout';
import { HomePage } from '../pages/home/HomePage';
import { VideoPage } from '../pages/video/VideoPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { UploadPageProtected } from '../pages/upload/UploadPageProtected';

// Root route
const rootRoute = createRootRoute({
    component: Layout,
});

// Index route (Home)
const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomePage,
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

// Route tree
const routeTree = rootRoute.addChildren([
    indexRoute,
    videoRoute,
    loginRoute,
    registerRoute,
    uploadRoute,
]);

// Create router
export const router = createRouter({ routeTree });
