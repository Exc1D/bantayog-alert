import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { logDimension } from '@bantayog/shared-validators';
const log = logDimension('onMediaFinalize');
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
export async function onMediaFinalizeCore(input) {
    if (!input.objectName.startsWith('pending/')) {
        return { status: 'accepted' };
    }
    const file = input.bucket.file(input.objectName);
    // download() without options returns [Buffer] per FileHandle contract
    const downloadResult = await file.download();
    if (!downloadResult)
        throw new Error('download returned undefined');
    // downloadResult is [Buffer] here — destructure to get the buffer
    const buf = downloadResult[0];
    // Guard against memory exhaustion: reject uploads larger than 50MB
    const MAX_SIZE = 50 * 1024 * 1024;
    if (buf.length > MAX_SIZE) {
        await file.delete();
        log({
            severity: 'WARNING',
            code: 'MEDIA_REJECTED_SIZE',
            message: `Deleted oversized upload (${String(buf.length)} bytes): ${input.objectName}`,
        });
        return { status: 'rejected_mime' };
    }
    const ft = await fileTypeFromBuffer(buf);
    if (!ft || !ALLOWED.has(ft.mime)) {
        await file.delete();
        log({
            severity: 'WARNING',
            code: 'MEDIA_REJECTED_MIME',
            message: `Deleted non-image: ${input.objectName}`,
        });
        return { status: 'rejected_mime' };
    }
    let cleaned;
    try {
        // rotate() alone strips EXIF/IPTC all by itself in libvips/sharp.
        // No need for withMetadata(false) — that actually re-enables metadata
        // in some sharp/libvips version combinations, defeating the strip.
        cleaned = await sharp(buf).rotate().toBuffer();
    }
    catch (err) {
        await file.delete();
        log({
            severity: 'WARNING',
            code: 'MEDIA_REJECTED_CORRUPT',
            message: `Deleted corrupt image: ${input.objectName}`,
            data: { error: String(err) },
        });
        return { status: 'rejected_mime' };
    }
    await file.save(cleaned, {
        resumable: false,
        contentType: ft.mime,
        metadata: { cacheControl: 'private, no-transform' },
    });
    const uploadId = input.objectName.slice('pending/'.length);
    const strippedAt = input.now ? input.now() : Date.now();
    await input.writePending({
        uploadId,
        storagePath: input.objectName,
        strippedAt,
        mimeType: ft.mime,
    });
    return { status: 'accepted' };
}
//# sourceMappingURL=on-media-finalize.js.map