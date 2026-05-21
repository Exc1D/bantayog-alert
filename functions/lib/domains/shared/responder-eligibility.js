export async function getEligibleResponders(db, rtdb, filter) {
    let q = db
        .collection('responders')
        .where('municipalityId', '==', filter.municipalityId)
        .where('isActive', '==', true);
    if (filter.agencyId) {
        q = q.where('agencyId', '==', filter.agencyId);
    }
    const [respondersSnap, shiftSnap] = await Promise.all([
        q.get(),
        rtdb.ref(`/responder_index/${filter.municipalityId}`).get(),
    ]);
    const shift = (shiftSnap.val() ?? {});
    return respondersSnap.docs
        .filter((doc) => shift[doc.id]?.isOnShift === true)
        .map((doc) => {
        const data = doc.data();
        return {
            uid: doc.id,
            displayName: String(data.displayName ?? ''),
            agencyId: String(data.agencyId ?? ''),
            municipalityId: data.municipalityId,
        };
    })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
//# sourceMappingURL=responder-eligibility.js.map