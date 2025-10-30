/**
 * Extract dominant color from an image URL
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<string>} - RGB color string
 */
export async function extractImageColor(imageUrl) {
    return new Promise((resolve, reject) => {
        console.log('🖼️ Loading image for color extraction:', imageUrl);

        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            console.log('✅ Image loaded successfully');
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                // Use small canvas for performance
                const size = 100;
                canvas.width = size;
                canvas.height = size;

                // Draw image
                ctx.drawImage(img, 0, 0, size, size);

                // Get image data
                const imageData = ctx.getImageData(0, 0, size, size);
                const data = imageData.data;

                // Calculate average color, giving more weight to center pixels
                let r = 0, g = 0, b = 0, count = 0;
                const centerWeight = 1.5; // Weight center pixels more

                for (let i = 0; i < data.length; i += 4) {
                    const pixelIndex = i / 4;
                    const x = pixelIndex % size;
                    const y = Math.floor(pixelIndex / size);

                    // Calculate distance from center (0 = center, 1 = edge)
                    const dx = (x / size) - 0.5;
                    const dy = (y / size) - 0.5;
                    const distFromCenter = Math.sqrt(dx * dx + dy * dy) * 2;
                    const weight = distFromCenter < 0.7 ? centerWeight : 1;

                    r += data[i] * weight;
                    g += data[i + 1] * weight;
                    b += data[i + 2] * weight;
                    count += weight;
                }

                r = Math.floor(r / count);
                g = Math.floor(g / count);
                b = Math.floor(b / count);

                // Enhance color intensity
                const intensity = 1.8;
                r = Math.min(255, Math.floor(r * intensity));
                g = Math.min(255, Math.floor(g * intensity));
                b = Math.min(255, Math.floor(b * intensity));

                resolve({ r, g, b });
            } catch (err) {
                reject(err);
            }
        };

        img.onerror = (e) => {
            console.error('❌ Failed to load image:', imageUrl, e);
            reject(new Error('Failed to load image: ' + imageUrl));
        };

        img.src = imageUrl;
    });
}

