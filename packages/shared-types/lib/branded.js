// Branded string types — prevent mixing IDs of different entities at compile time.
// Runtime cost: zero. Compile-time benefit: entire class of "wrong ID passed" bugs eliminated.
export const asAgencyId = (v) => v;
export const asMunicipalityId = (v) => v;
//# sourceMappingURL=branded.js.map