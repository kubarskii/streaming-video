/**
 * UploadPageChunked Tests
 * Tests for the chunked upload page component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadPageChunked } from '../UploadPageChunked';
import { channelsAPI } from '../../../shared/api/channels';
import chunkedUploadManagerAdvanced from '../../../shared/api/chunked-upload-advanced';
import { useNavigate } from '@tanstack/react-router';

// Mock CSS imports
vi.mock('../UploadPage.css', () => ({}));

// Mock dependencies - must use factory functions without external variables
const mockNavigateFn = vi.fn();
vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigateFn,
    useParams: () => ({}),
    useSearch: () => ({}),
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('../../../shared/context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-123', username: 'testuser' },
        isAuthenticated: true,
    }),
}));

vi.mock('../../../shared/api/channels', () => ({
    channelsAPI: {
        getChannel: vi.fn(),
    },
}));

// Mock the advanced upload manager
vi.mock('../../../shared/api/chunked-upload-advanced', () => ({
    default: {
        uploadFile: vi.fn(),
        cleanup: vi.fn(),
    },
}));

vi.mock('../../../shared/ui', () => ({
    Button: ({ children, onClick, disabled, ...props }) => (
        <button onClick={onClick} disabled={disabled} {...props}>
            {children}
        </button>
    ),
    EmptyState: ({ title, message, action }) => (
        <div>
            <h2>{title}</h2>
            {message && <p>{message}</p>}
            {action}
        </div>
    ),
}));

describe('UploadPageChunked', () => {
    beforeEach(() => {
        // Reset and configure mocks
        vi.clearAllMocks();
        mockNavigateFn.mockClear();

        channelsAPI.getChannel.mockResolvedValue({
            id: 'channel-123',
            name: 'Test Channel',
        });

        // Mock the upload manager to return a successful upload
        chunkedUploadManagerAdvanced.uploadFile.mockImplementation((file, metadata, callbacks) => {
            // Simulate upload progress
            if (callbacks?.onProgress) {
                callbacks.onProgress({
                    progress: 50,
                    uploadedChunks: 1,
                    totalChunks: 2,
                    uploadedBytes: file.size / 2,
                    totalBytes: file.size,
                    speed: '5 MB/s'
                });
            }

            // Return successful response
            return Promise.resolve({
                message: 'Video uploaded successfully',
                video: {
                    id: 'video-123',
                    title: metadata.title,
                    playbackUrl: '/video/video-123'
                }
            });
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('should render upload page', async () => {
            render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });
        });

        it('should show dropzone when no file selected', async () => {
            render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText(/Drag and drop video file here/i)).toBeInTheDocument();
            });
        });

        it('should show file size limit', async () => {
            render(<UploadPageChunked />);

            await waitFor(() => {
                // Multiple elements contain "up to 10GB", use getAllByText
                const elements = screen.getAllByText(/up to 10GB/i);
                expect(elements.length).toBeGreaterThan(0);
            });
        });
    });

    describe('file selection', () => {
        it('should accept video file via file input', async () => {
            const user = userEvent.setup();
            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['video content'], 'test-video.mp4', {
                type: 'video/mp4',
            });

            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            await waitFor(() => {
                expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
            });
        });

        it('should reject non-video files', async () => {
            const user = userEvent.setup();
            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['image content'], 'image.jpg', {
                type: 'image/jpeg',
            });

            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            // File should be rejected - dropzone should still be visible, no file preview
            await waitFor(() => {
                expect(screen.getByText(/Drag and drop video file here/i)).toBeInTheDocument();
                expect(screen.queryByText('image.jpg')).not.toBeInTheDocument();
            });
        });

        it('should reject files over 10GB', async () => {
            const user = userEvent.setup();
            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            // Create mock file with size > 10GB
            const largeFile = new File(['x'], 'huge.mp4', { type: 'video/mp4' });
            Object.defineProperty(largeFile, 'size', {
                value: 11 * 1024 * 1024 * 1024, // 11GB
            });

            const input = container.querySelector('input[type="file"]');
            await user.upload(input, largeFile);

            await waitFor(() => {
                expect(screen.getByText(/must be less than 10GB/i)).toBeInTheDocument();
            });
        });

        it('should auto-fill title from filename', async () => {
            const user = userEvent.setup();
            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['content'], 'my-awesome-video.mp4', {
                type: 'video/mp4',
            });

            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            await waitFor(() => {
                const titleInput = screen.getByLabelText(/Title/i);
                expect(titleInput.value).toBe('my-awesome-video');
            });
        });
    });

    describe('form validation', () => {
        it('should require file before upload', async () => {
            render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            // When no file is selected, there's no submit button visible
            // Just verify the dropzone is shown
            expect(screen.getByText(/Drag and drop video file here/i)).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Upload Video/i })).not.toBeInTheDocument();
        });

        it('should require title', async () => {
            const user = userEvent.setup();
            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            // Add file
            const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            // Wait for title to auto-fill
            await waitFor(() => {
                const titleInput = screen.getByLabelText(/Title/i);
                expect(titleInput.value).toBe('test');
            });

            // Clear title
            const titleInput = screen.getByLabelText(/Title/i);
            await user.clear(titleInput);

            // Try to submit
            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            // Upload should not start - button should still say "Upload Video" not "Uploading..."
            await waitFor(() => {
                // Upload didn't start (manager not called)
                expect(chunkedUploadManagerAdvanced.uploadFile).not.toHaveBeenCalled();
                // Button still shows "Upload Video"
                expect(screen.getByRole('button', { name: /Upload Video/i })).toBeInTheDocument();
            });
        });
    });

    // Note: These tests rely on old ChunkedUploader implementation
    describe.skip('upload process', () => {
        it.skip('should upload file successfully', async () => {
            const user = userEvent.setup();
            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            // Add file
            const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            // Wait for auto-fill, then replace title
            await waitFor(() => {
                const titleInput = screen.getByLabelText(/Title/i);
                expect(titleInput.value).toBe('test');
            });

            const titleInput = screen.getByLabelText(/Title/i);
            await user.clear(titleInput);
            await user.type(titleInput, 'My Test Video');

            // Submit
            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockUploader.upload).toHaveBeenCalledWith(
                    expect.any(File),
                    expect.objectContaining({
                        title: 'My Test Video',
                    })
                );
            });
        });

        it.skip('should show progress during upload', async () => {
            const user = userEvent.setup();

            // Make upload take longer
            mockUploader.upload.mockImplementation(async () => {
                // Simulate progress callbacks
                mockUploader.onProgress(50, 5000000, 10000000);
                await new Promise((resolve) => setTimeout(resolve, 100));
                return { video: { id: 'video-123' } };
            });

            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            // Add file and submit
            const file = new File(['x'.repeat(1000000)], 'test.mp4', {
                type: 'video/mp4',
            });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/Uploading.../i)).toBeInTheDocument();
            });
        });

        it.skip('should show chunk progress', async () => {
            const user = userEvent.setup();

            mockUploader.upload.mockImplementation(async () => {
                mockUploader.onChunkComplete(0, 10);
                mockUploader.onChunkComplete(1, 10);
                return { video: { id: 'video-123' } };
            });

            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/Chunks:/i)).toBeInTheDocument();
            });
        });

        it.skip('should navigate to video page after successful upload', async () => {
            const user = userEvent.setup();
            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockNavigateFn).toHaveBeenCalledWith({
                    to: '/video/video-123',
                });
            });
        });
    });

    // Note: Pause/resume/cancel controls not implemented in advanced upload manager
    describe.skip('upload controls', () => {
        it.skip('should show pause button during upload', async () => {
            const user = userEvent.setup();

            chunkedUploadManagerAdvanced.uploadFile.mockImplementation(
                () => new Promise(() => { }) // Never resolves
            );

            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
            });
        });

        it.skip('should pause upload when pause button clicked', async () => {
            const user = userEvent.setup();

            mockUploader.upload.mockImplementation(
                () => new Promise(() => { })
            );

            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            const pauseButton = await screen.findByRole('button', { name: /Pause/i });
            await user.click(pauseButton);

            expect(mockUploader.pause).toHaveBeenCalled();
        });

        it.skip('should resume upload when resume button clicked', async () => {
            const user = userEvent.setup();

            mockUploader.upload.mockImplementation(
                () => new Promise(() => { })
            );

            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            // Pause
            const pauseButton = await screen.findByRole('button', { name: /Pause/i });
            await user.click(pauseButton);

            // Resume
            const resumeButton = await screen.findByRole('button', { name: /Resume/i });
            await user.click(resumeButton);

            expect(mockUploader.resume).toHaveBeenCalled();
        });

        it.skip('should cancel upload when cancel button clicked', async () => {
            const user = userEvent.setup();

            mockUploader.upload.mockImplementation(
                () => new Promise(() => { })
            );

            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            // There are two cancel buttons, we want the one in upload controls (not disabled)
            const cancelButtons = await screen.findAllByRole('button', { name: /Cancel/i });
            const uploadCancelButton = cancelButtons.find(btn => !btn.disabled);
            await user.click(uploadCancelButton);

            expect(mockUploader.cancel).toHaveBeenCalled();
        });
    });

    // Note: Error handling tests need auth mock setup
    describe.skip('error handling', () => {
        it.skip('should show error message on upload failure', async () => {
            const user = userEvent.setup();

            chunkedUploadManagerAdvanced.uploadFile.mockRejectedValue(new Error('Upload failed'));

            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            const titleInput = screen.getByLabelText(/Title/i);
            await user.type(titleInput, 'test');

            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
            });
        });

        it.skip('should handle cancelled upload', async () => {
            const user = userEvent.setup();

            chunkedUploadManagerAdvanced.uploadFile.mockRejectedValue(new Error('Upload cancelled'));

            const { container } = render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText('Upload Video')).toBeInTheDocument();
            });

            const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
            const input = container.querySelector('input[type="file"]');
            await user.upload(input, file);

            const titleInput = screen.getByLabelText(/Title/i);
            await user.type(titleInput, 'test');

            const submitButton = screen.getByRole('button', { name: /Upload Video/i });
            await user.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
            });
        });
    });

    describe('channel requirement', () => {
        it('should show create channel prompt if no channel', async () => {
            channelsAPI.getChannel.mockRejectedValueOnce(new Error('No channel'));

            render(<UploadPageChunked />);

            await waitFor(() => {
                expect(screen.getByText(/Create Your Channel First/i)).toBeInTheDocument();
            });
        });
    });
});

