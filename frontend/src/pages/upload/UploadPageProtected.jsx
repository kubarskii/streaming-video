// Protected Upload Page Wrapper
import { ProtectedRoute } from '../../app/ProtectedRoute';
import { UploadPageChunked } from './UploadPageChunked';

export const UploadPageProtected = () => {
    return (
        <ProtectedRoute>
            <UploadPageChunked />
        </ProtectedRoute>
    );
};

