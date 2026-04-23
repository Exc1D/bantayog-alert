let cachedMunis = null;
async function loadMunicipalities(db) {
    if (cachedMunis)
        return cachedMunis;
    const snap = await db.collection('municipalities').get();
    cachedMunis = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return cachedMunis;
}
function squaredDistance(a, b) {
    const dLat = a.lat - b.lat;
    const dLng = a.lng - b.lng;
    return dLat * dLat + dLng * dLng;
}
export async function reverseGeocodeToMunicipality(db, location) {
    const munis = await loadMunicipalities(db);
    if (munis.length === 0)
        return null;
    let nearest = null;
    let nearestDist = Infinity;
    for (const m of munis) {
        if (!m.centroid)
            continue;
        const dist = squaredDistance(location, m.centroid);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = m;
        }
    }
    if (!nearest?.centroid)
        return null;
    const MAX_SQUARED_DIST = 1.0;
    if (nearestDist > MAX_SQUARED_DIST)
        return null;
    return {
        municipalityId: nearest.id,
        municipalityLabel: nearest.label,
        barangayId: 'unknown',
        ...(nearest.defaultSmsLocale ? { defaultSmsLocale: nearest.defaultSmsLocale } : {}),
    };
}
//# sourceMappingURL=geocode.js.map