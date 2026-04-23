import { type RulesTestEnvironment } from '@firebase/rules-unit-testing';
export declare function createTestEnv(projectId: string): Promise<RulesTestEnvironment>;
export declare function authed(env: RulesTestEnvironment, uid: string, claims: Record<string, unknown>): import("firebase/compat/app").default.firestore.Firestore;
export declare function unauthed(env: RulesTestEnvironment): import("firebase/compat/app").default.firestore.Firestore;
//# sourceMappingURL=rules-harness.d.ts.map