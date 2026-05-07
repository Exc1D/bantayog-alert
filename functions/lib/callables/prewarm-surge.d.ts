interface PrewarmSurgeActor {
    uid: string;
    role: string;
}
export declare function prewarmSurgeCore(actor: PrewarmSurgeActor, level: 'light' | 'heavy'): Promise<{
    warmed: number;
}>;
export declare const prewarmSurge: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    warmed: number;
}>, unknown>;
export {};
//# sourceMappingURL=prewarm-surge.d.ts.map