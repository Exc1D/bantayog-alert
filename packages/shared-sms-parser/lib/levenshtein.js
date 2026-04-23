export function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0)
        return n;
    if (n === 0)
        return m;
    // Flat 1D array for memory efficiency and to avoid noUncheckedIndexedAccess
    const dp = new Uint32Array((m + 1) * (n + 1));
    for (let i = 0; i <= m; i++)
        dp[i * (n + 1)] = i;
    for (let j = 0; j <= n; j++)
        dp[j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const idx = i * (n + 1) + j;
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            const deletion = dp[(i - 1) * (n + 1) + j];
            const insertion = dp[i * (n + 1) + (j - 1)];
            const substitution = dp[(i - 1) * (n + 1) + (j - 1)];
            if (deletion === undefined || insertion === undefined || substitution === undefined) {
                throw new Error('Levenshtein DP index out of bounds');
            }
            dp[idx] = Math.min(deletion + 1, insertion + 1, substitution + cost);
        }
    }
    const result = dp[m * (n + 1) + n];
    return result ?? 0;
}
//# sourceMappingURL=levenshtein.js.map