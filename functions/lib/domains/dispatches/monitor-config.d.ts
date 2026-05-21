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
export declare function getMonitorConfig(): Promise<MonitorConfig>;
//# sourceMappingURL=monitor-config.d.ts.map