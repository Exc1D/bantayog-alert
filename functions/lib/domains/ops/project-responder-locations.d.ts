import type { Database } from 'firebase-admin/database';
export type Freshness = 'fresh' | 'degraded' | 'stale' | 'offline';
export interface ProjectionEntry {
    lat: number;
    lng: number;
    freshness: Freshness;
    lastSeenAt: number;
}
export declare function roundToGrid(value: number): number;
export declare function computeFreshness(telemetryAgeMs: number): Freshness;
export interface ProjectResponderLocationsDeps {
    now: number;
}
export declare function projectResponderLocationsCore(database: Database, deps: ProjectResponderLocationsDeps): Promise<void>;
export declare const projectResponderLocations: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=project-responder-locations.d.ts.map