// @ts-check
// Infrastructure: Content Sanitizer
// Sanitizes user-generated content to prevent XSS attacks

/**
 * Sanitizes user-generated content by:
 * 1. Stripping HTML tags
 * 2. Escaping special characters
 * 3. Trimming whitespace
 * 4. Enforcing length limits
 */
class ContentSanitizer {
    /**
     * Maximum length for different content types
     */
    static MAX_LENGTHS = {
        comment: 5000,
        title: 200,
        description: 10000,
        channelName: 100,
        channelDescription: 1000,
        playlistTitle: 200,
        playlistDescription: 2000
    };

    /**
     * Sanitize comment content
     * @param {string} content - Raw comment content
     * @returns {string} Sanitized content
     */
    static sanitizeComment(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        // Remove HTML tags (including script, iframe, img with onerror, etc.)
        // Use a more aggressive regex that handles nested tags and attributes
        let sanitized = content.replace(/<[^>]+>/g, '');
        
        // Escape HTML entities
        sanitized = this.escapeHtml(sanitized);
        
        // Remove javascript: protocol attempts
        sanitized = sanitized.replace(/javascript:/gi, '');
        
        // Trim and normalize whitespace
        sanitized = sanitized.trim().replace(/\s+/g, ' ');
        
        // Enforce length limit
        const maxLength = this.MAX_LENGTHS.comment;
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        return sanitized;
    }

    /**
     * Sanitize video/channel/playlist title
     * @param {string} title - Raw title
     * @param {string} type - Type of title ('title', 'channelName', 'playlistTitle')
     * @returns {string} Sanitized title
     */
    static sanitizeTitle(title, type = 'title') {
        if (!title || typeof title !== 'string') {
            return '';
        }

        // Remove HTML tags
        let sanitized = title.replace(/<[^>]+>/g, '');
        
        // Escape HTML entities
        sanitized = this.escapeHtml(sanitized);
        
        // Remove javascript: protocol attempts
        sanitized = sanitized.replace(/javascript:/gi, '');
        
        // Trim and normalize whitespace
        sanitized = sanitized.trim().replace(/\s+/g, ' ');
        
        // Enforce length limit based on type
        const maxLength = this.MAX_LENGTHS[type] || this.MAX_LENGTHS.title;
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        return sanitized;
    }

    /**
     * Sanitize description (video, channel, playlist)
     * @param {string|null|undefined} description - Raw description
     * @param {string} type - Type of description ('description', 'channelDescription', 'playlistDescription')
     * @returns {string|null} Sanitized description or null
     */
    static sanitizeDescription(description, type = 'description') {
        if (!description || typeof description !== 'string') {
            return null;
        }

        // Remove HTML tags
        let sanitized = description.replace(/<[^>]+>/g, '');
        
        // Escape HTML entities
        sanitized = this.escapeHtml(sanitized);
        
        // Remove javascript: protocol attempts
        sanitized = sanitized.replace(/javascript:/gi, '');
        
        // Trim and normalize whitespace (preserve newlines as spaces)
        sanitized = sanitized.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
        
        // Enforce length limit based on type
        const maxLength = this.MAX_LENGTHS[type] || this.MAX_LENGTHS.description;
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        return sanitized.length > 0 ? sanitized : null;
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    static escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Validate and sanitize all user input in an object
     * @param {Object} input - Input object with user-generated fields
     * @param {Object} fieldTypes - Map of field names to sanitization types
     * @returns {Object} Sanitized input object
     */
    static sanitizeInput(input, fieldTypes) {
        const sanitized = { ...input };
        
        for (const [field, type] of Object.entries(fieldTypes)) {
            if (field in sanitized && sanitized[field] !== null && sanitized[field] !== undefined) {
                switch (type) {
                    case 'comment':
                        sanitized[field] = this.sanitizeComment(sanitized[field]);
                        break;
                    case 'title':
                        sanitized[field] = this.sanitizeTitle(sanitized[field], 'title');
                        break;
                    case 'channelName':
                        sanitized[field] = this.sanitizeTitle(sanitized[field], 'channelName');
                        break;
                    case 'playlistTitle':
                        sanitized[field] = this.sanitizeTitle(sanitized[field], 'playlistTitle');
                        break;
                    case 'description':
                        sanitized[field] = this.sanitizeDescription(sanitized[field], 'description');
                        break;
                    case 'channelDescription':
                        sanitized[field] = this.sanitizeDescription(sanitized[field], 'channelDescription');
                        break;
                    case 'playlistDescription':
                        sanitized[field] = this.sanitizeDescription(sanitized[field], 'playlistDescription');
                        break;
                    default:
                        // Default: escape HTML but don't strip tags
                        if (typeof sanitized[field] === 'string') {
                            sanitized[field] = this.escapeHtml(sanitized[field].trim());
                        }
                }
            }
        }
        
        return sanitized;
    }
}

module.exports = ContentSanitizer;

