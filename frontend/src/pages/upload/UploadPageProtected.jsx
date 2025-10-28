// Protected Upload Page Wrapper
import { ProtectedRoute } from '../../app/ProtectedRoute';
import { UploadPage } from './UploadPage';

export const UploadPageProtected = () => {
    return (
        <ProtectedRoute>
            <UploadPage />
        </ProtectedRoute>
    );
};

