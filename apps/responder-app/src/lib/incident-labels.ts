export const REPORT_TYPE_LABEL: Record<string, string> = {
  flood: '🌊 Flood',
  fire: '🔥 Fire',
  earthquake: '🌍 Earthquake',
  typhoon: '🌀 Typhoon',
  landslide: '⛰️ Landslide',
  storm_surge: '🌊 Storm Surge',
  medical: '🏥 Medical',
  accident: '💥 Accident',
  structural: '🏚️ Structural',
  security: '🚔 Security',
  other: '⚠️ Other',
}

export const RESPONDER_TYPE_LABEL: Record<string, string> = {
  police: 'Police',
  fire: 'Fire',
  medical: 'Medical',
  engineering: 'Engineering',
  sar: 'Search & Rescue',
  social_welfare: 'Social Welfare',
  general: 'General',
}

export function getReportTypeLabel(type: string | undefined): string {
  if (type == null) return REPORT_TYPE_LABEL.other ?? 'Other'
  return REPORT_TYPE_LABEL[type] ?? type
}

export function getResponderTypeLabel(type: string | undefined): string {
  if (type == null) return RESPONDER_TYPE_LABEL.general ?? 'General'
  return RESPONDER_TYPE_LABEL[type] ?? RESPONDER_TYPE_LABEL.general ?? 'General'
}
