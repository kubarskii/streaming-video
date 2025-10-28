// Value Object: VideoStatus
// Represents the status of a video

class VideoStatus {
    static PENDING = 'pending';
    static PROCESSING = 'processing';
    static READY = 'ready';
    static FAILED = 'failed';

    static isValid(status) {
        return [
            VideoStatus.PENDING,
            VideoStatus.PROCESSING,
            VideoStatus.READY,
            VideoStatus.FAILED
        ].includes(status);
    }

    static validate(status) {
        if (!VideoStatus.isValid(status)) {
            throw new Error(`Invalid video status: ${status}`);
        }
    }
}

module.exports = VideoStatus;

