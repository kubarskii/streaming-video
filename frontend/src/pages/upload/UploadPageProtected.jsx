// Protected Upload Page Wrapper
import { ProtectedRoute } from '../../app/ProtectedRoute';
import { UploadPage } from './UploadPageIntegrated';

export const UploadPageProtected = () => {
    return (
        <ProtectedRoute>
            <UploadPage />
        </ProtectedRoute>
    );
};

