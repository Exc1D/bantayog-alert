export interface OnMediaFinalizeInput {
    bucket: {
        file(name: string): FileHandle;
    };
    objectName: string;
    now?: () => number;
    writePending: (doc: {
        uploadId: string;
        storagePath: string;
        strippedAt: number;
        mimeType: string;
    }) => Promise<void>;
}
export interface OnMediaFinalizeResult {
    status: 'accepted' | 'rejected_mime';
}
export declare function onMediaFinalizeCore(input: OnMediaFinalizeInput): Promise<OnMediaFinalizeResult>;
export interface FileHandle {
    download(options?: {
        destination: string;
    }): Promise<[Buffer] | undefined>;
    save(buf: Buffer, opts: {
        resumable: boolean;
        contentType: string;
        metadata: Record<string, string>;
    }): Promise<void>;
    delete(): Promise<void>;
}
//# sourceMappingURL=on-media-finalize.d.ts.map