// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');

const ContentSanitizer = require('../../src/infrastructure/security/ContentSanitizer');

describe('ContentSanitizer', () => {
    describe('sanitizeComment', () => {
        test('should strip HTML tags', () => {
            const input = '<script>alert("XSS")</script>Hello World';
            const result = ContentSanitizer.sanitizeComment(input);
            // Script tags are removed, content inside is escaped (safe but visible)
            assert.ok(!result.includes('<script'));
            assert.ok(!result.includes('</script>'));
            assert.ok(result.includes('Hello World'));
        });

        test('should escape HTML entities', () => {
            const input = 'Hello <world> & "friends"';
            const result = ContentSanitizer.sanitizeComment(input);
            // Tags are stripped first, then entities are escaped
            assert.strictEqual(result, 'Hello &amp; &quot;friends&quot;');
        });

        test('should enforce length limit', () => {
            const longInput = 'a'.repeat(10000);
            const result = ContentSanitizer.sanitizeComment(longInput);
            assert.strictEqual(result.length, 5000);
        });

        test('should trim whitespace', () => {
            const input = '  Hello World  ';
            const result = ContentSanitizer.sanitizeComment(input);
            assert.strictEqual(result, 'Hello World');
        });

        test('should handle empty string', () => {
            const result = ContentSanitizer.sanitizeComment('');
            assert.strictEqual(result, '');
        });
    });

    describe('sanitizeTitle', () => {
        test('should strip HTML tags from title', () => {
            const input = '<b>My Video</b>';
            const result = ContentSanitizer.sanitizeTitle(input);
            assert.strictEqual(result, 'My Video');
        });

        test('should escape HTML entities', () => {
            const input = 'Video < 2024';
            const result = ContentSanitizer.sanitizeTitle(input);
            assert.strictEqual(result, 'Video &lt; 2024');
        });

        test('should enforce title length limit', () => {
            const longInput = 'a'.repeat(300);
            const result = ContentSanitizer.sanitizeTitle(longInput);
            assert.strictEqual(result.length, 200);
        });

        test('should handle channel name length', () => {
            const longInput = 'a'.repeat(150);
            const result = ContentSanitizer.sanitizeTitle(longInput, 'channelName');
            assert.strictEqual(result.length, 100);
        });
    });

    describe('sanitizeDescription', () => {
        test('should strip HTML tags from description', () => {
            const input = '<p>My description</p>';
            const result = ContentSanitizer.sanitizeDescription(input);
            assert.strictEqual(result, 'My description');
        });

        test('should return null for empty description', () => {
            const result = ContentSanitizer.sanitizeDescription('');
            assert.strictEqual(result, null);
        });

        test('should enforce description length limit', () => {
            const longInput = 'a'.repeat(15000);
            const result = ContentSanitizer.sanitizeDescription(longInput);
            assert.notStrictEqual(result, null);
            assert.strictEqual(result?.length, 10000);
        });

        test('should normalize whitespace', () => {
            const input = 'Line 1\n\nLine 2   Line 3';
            const result = ContentSanitizer.sanitizeDescription(input);
            assert.strictEqual(result, 'Line 1 Line 2 Line 3');
        });
    });

    describe('escapeHtml', () => {
        test('should escape all HTML special characters', () => {
            const input = '<script>& "test" \'value\'</script>';
            const result = ContentSanitizer.escapeHtml(input);
            assert.strictEqual(result, '&lt;script&gt;&amp; &quot;test&quot; &#039;value&#039;&lt;/script&gt;');
        });
    });

    describe('XSS attack prevention', () => {
        test('should prevent script injection in comments', () => {
            const xssAttempts = [
                '<script>alert("XSS")</script>',
                '<img src=x onerror=alert("XSS")>',
                '<svg onload=alert("XSS")>',
                'javascript:alert("XSS")',
                '<iframe src="javascript:alert(\'XSS\')"></iframe>'
            ];

            xssAttempts.forEach(attempt => {
                const result = ContentSanitizer.sanitizeComment(attempt);
                assert.ok(!result.includes('<script'), `Should not contain <script: ${result}`);
                assert.ok(!result.includes('onerror'), `Should not contain onerror: ${result}`);
                assert.ok(!result.includes('onload'), `Should not contain onload: ${result}`);
                assert.ok(!result.includes('javascript:'), `Should not contain javascript:: ${result}`);
            });
        });

        test('should prevent script injection in titles', () => {
            const xssAttempt = '<script>alert("XSS")</script>My Title';
            const result = ContentSanitizer.sanitizeTitle(xssAttempt);
            // Script tags removed, content escaped (safe)
            assert.ok(!result.includes('<script'));
            assert.ok(!result.includes('</script>'));
            assert.ok(result.includes('My Title'));
        });

        test('should prevent script injection in descriptions', () => {
            const xssAttempt = '<script>alert("XSS")</script>My Description';
            const result = ContentSanitizer.sanitizeDescription(xssAttempt);
            // Script tags removed, content escaped (safe)
            assert.notStrictEqual(result, null);
            assert.ok(!result?.includes('<script'));
            assert.ok(!result?.includes('</script>'));
            assert.ok(result?.includes('My Description'));
        });
    });
});

