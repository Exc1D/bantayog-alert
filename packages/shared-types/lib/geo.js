const GEOHASH_RE = /^[0123456789bcdefghjkmnpqrstuvwxyz]{1,12}$/i;
export const asGeohash = (v) => {
    if (!GEOHASH_RE.test(v))
        throw new TypeError('Invalid geohash');
    return v.toLowerCase();
};
//# sourceMappingURL=geo.js.map