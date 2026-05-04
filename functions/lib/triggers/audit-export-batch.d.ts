export declare function auditExportBatchCore(opts: {
    bqTable: {
        insert(rows: unknown[]): Promise<unknown>;
    };
    loggingLog: {
        getEntries(options: {
            pageSize: number;
            filter?: string;
            autoPaginate?: boolean;
        }): Promise<[unknown[], ...unknown[]]>;
    };
    now?: () => number;
}): Promise<{
    exported: number;
}>;
export declare const auditExportBatch: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=audit-export-batch.d.ts.map