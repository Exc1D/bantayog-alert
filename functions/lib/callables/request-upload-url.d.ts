export interface RequestUploadUrlInput {
    auth: {
        uid: string;
    } | undefined;
    data: unknown;
    bucket: string;
}
export interface RequestUploadUrlResult {
    uploadUrl: string;
    uploadId: string;
    storagePath: string;
    expiresAt: number;
}
export declare function requestUploadUrlImpl(input: RequestUploadUrlInput): Promise<RequestUploadUrlResult>;
export declare const requestUploadUrl: import("firebase-functions/https").CallableFunction<any, Promise<RequestUploadUrlResult>, unknown>;
//# sourceMappingURL=request-upload-url.d.ts.map