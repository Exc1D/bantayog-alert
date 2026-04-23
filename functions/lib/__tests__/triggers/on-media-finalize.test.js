import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
import { onMediaFinalizeCore } from '../../triggers/on-media-finalize.js';
const mockFile = {
    download: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    setMetadata: vi.fn().mockResolvedValue(undefined),
};
function bucket() {
    return {
        file: vi.fn(() => mockFile),
    };
}
beforeEach(() => {
    mockFile.download.mockReset();
    mockFile.save.mockReset().mockResolvedValue(undefined);
    mockFile.delete.mockReset().mockResolvedValue(undefined);
    mockFile.setMetadata.mockReset().mockResolvedValue(undefined);
});
describe('onMediaFinalizeCore', () => {
    it('rejects and deletes a non-image upload', async () => {
        mockFile.download.mockResolvedValue([Buffer.from('%PDF-1.4\n', 'utf8')]);
        const writePending = vi.fn();
        const result = await onMediaFinalizeCore({
            bucket: bucket(),
            objectName: 'pending/abc',
            writePending,
        });
        expect(result.status).toBe('rejected_mime');
        expect(mockFile.delete).toHaveBeenCalled();
        expect(writePending).not.toHaveBeenCalled();
    });
    it('accepts valid JPEG upload', async () => {
        const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==', 'base64');
        mockFile.download.mockResolvedValue([jpeg]);
        const writePending = vi.fn();
        const result = await onMediaFinalizeCore({
            bucket: bucket(),
            objectName: 'pending/upload-1',
            writePending,
        });
        expect(result.status).toBe('accepted');
        expect(writePending).toHaveBeenCalledTimes(1);
        expect(mockFile.save).toHaveBeenCalled();
    });
    it('strips all EXIF metadata including GPS from JPEG', async () => {
        // Create a JPEG with EXIF metadata using sharp
        const jpegWithExif = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 3,
                background: { r: 255, g: 0, b: 0 },
            },
        })
            .jpeg()
            .withMetadata() // sharp adds EXIF metadata by default
            .toBuffer();
        // Verify the created JPEG has EXIF data
        const inputMeta = await sharp(jpegWithExif).metadata();
        expect(inputMeta.exif).toBeDefined();
        mockFile.download.mockResolvedValue([jpegWithExif]);
        const writePending = vi.fn();
        const result = await onMediaFinalizeCore({
            bucket: bucket(),
            objectName: 'pending/upload-2',
            writePending,
        });
        expect(result.status).toBe('accepted');
        // Capture the saved buffer
        const savedBuffer = mockFile.save.mock.calls[0]?.[0];
        // Verify the saved buffer has NO EXIF data (GPS is stored in EXIF, so no EXIF = no GPS)
        const outputMeta = await sharp(savedBuffer).metadata();
        expect(outputMeta.exif).toBeUndefined();
    });
});
//# sourceMappingURL=on-media-finalize.test.js.map