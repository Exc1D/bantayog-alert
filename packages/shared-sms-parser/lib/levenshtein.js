export function levenshtein(a, b) {
    let s = a;
    let t = b;
    if (s.length > t.length) {
        ;
        [s, t] = [t, s];
    }
    const m = s.length;
    const n = t.length;
    let prev = new Uint32Array(n + 1);
    let curr = new Uint32Array(n + 1);
    for (let j = 0; j <= n; j++) {
        prev[j] = j;
    }
    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        const sChar = s[i - 1];
        for (let j = 1; j <= n; j++) {
            const cost = sChar === t[j - 1] ? 0 : 1;
            const deletion = (prev[j] ?? 0) + 1;
            const insertion = (curr[j - 1] ?? 0) + 1;
            const substitution = (prev[j - 1] ?? 0) + cost;
            curr[j] = Math.min(deletion, insertion, substitution);
        }
        const tmp = prev;
        prev = curr;
        curr = tmp;
    }
    return prev[n] ?? 0;
}
//# sourceMappingURL=levenshtein.js.map