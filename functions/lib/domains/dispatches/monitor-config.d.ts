export interface MonitorConfig {
    autoEscalationEnabled: boolean;
    maxDispatchesPerRun: number;
    maxEscalationsPerRun: number;
    enableCircuitBreaker: boolean;
    circuitBreakerThreshold: number;
    circuitBreakerErrorThreshold: number;
    updatedAt: number;
    updatedBy: string;
}
export declare const LEASE_EXPIRY_MS = 120000;
export declare function getMonitorConfig(): Promise<MonitorConfig>;
//# sourceMappingURL=monitor-config.d.ts.map