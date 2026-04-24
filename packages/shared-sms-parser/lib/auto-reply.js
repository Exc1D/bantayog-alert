export function buildAutoReply(confidence, publicRef) {
    // publicRef builds the ref prefix; the trigger caller may append additional context after this returns
    const ref = publicRef ? ` Ref: ${publicRef}.` : '';
    switch (confidence) {
        case 'high':
            return `Received.${ref} MDRRMO reviewing.`;
        case 'medium':
            return `Received.${ref} Our team may contact you for details.`;
        case 'low':
            return `Received.${ref} Our team reviewing your report.`;
        case 'none':
        default:
            return 'We received your message. To report an emergency, text: BANTAYOG <TYPE> <BARANGAY>. Types: FLOOD, FIRE, ACCIDENT, MEDICAL, LANDSLIDE, OTHER.';
    }
}
//# sourceMappingURL=auto-reply.js.map