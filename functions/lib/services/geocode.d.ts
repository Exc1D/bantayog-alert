import type { Firestore } from 'firebase-admin/firestore';
interface GeoPoint {
    lat: number;
    lng: number;
}
export interface ReverseGeocodeResult {
    municipalityId: string;
    municipalityLabel: string;
    barangayId: string;
    defaultSmsLocale?: 'tl' | 'en';
}
export declare function reverseGeocodeToMunicipality(db: Firestore, location: GeoPoint): Promise<ReverseGeocodeResult | null>;
export {};
//# sourceMappingURL=geocode.d.ts.map