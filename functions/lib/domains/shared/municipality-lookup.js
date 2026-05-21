import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
export function createMunicipalityLookup(db) {
    let cache = null;
    async function ensureLoaded() {
        if (cache)
            return cache;
        const snap = await db.collection('municipalities').get();
        const map = new Map();
        for (const d of snap.docs) {
            const data = d.data();
            map.set(d.id, data.label);
        }
        cache = map;
        return map;
    }
    return {
        async label(id) {
            const map = await ensureLoaded();
            const v = map.get(id);
            if (v === undefined) {
                throw new BantayogError(BantayogErrorCode.MUNICIPALITY_NOT_FOUND, `Municipality '${id}' is not in jurisdiction.`);
            }
            return v;
        },
    };
}
//# sourceMappingURL=municipality-lookup.js.map