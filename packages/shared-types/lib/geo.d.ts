import type { BarangayId, MunicipalityId } from './branded.js';
export interface GeoPoint {
    readonly lat: number;
    readonly lng: number;
}
export interface BoundingBox {
    readonly sw: GeoPoint;
    readonly ne: GeoPoint;
}
export type Geohash = string & {
    readonly __brand: 'Geohash';
};
export declare const asGeohash: (v: string) => Geohash;
export interface ApproximateLocation {
    readonly municipality: MunicipalityId;
    readonly barangay: BarangayId;
    readonly geohash: Geohash;
}
//# sourceMappingURL=geo.d.ts.map