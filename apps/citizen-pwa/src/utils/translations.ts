export const T = {
  'status.queued': 'Your report is being processed',
  'status.queued_tl': 'Pinoproseso ang iyong ulat',
  'status.received': 'Report received',
  'status.received_tl': 'Natanggap ang ulat',
  'status.verifying': 'Awaiting admin verification',
  'status.verifying_tl': 'Hinihintay ang pag-verify ng admin',
  'status.responders_notified': 'Responders have been notified',
  'status.responders_notified_tl': 'Naabisuhan na ang mga responder',
  'status.dispatched': 'Responders are on the way',
  'status.dispatched_tl': 'Paparating na ang mga responder',
  'status.resolved': 'Situation resolved',
  'status.resolved_tl': 'Naresolba na ang sitwasyon',
  'status.cancelled': 'Report withdrawn',
  'status.cancelled_tl': 'Na-withdraw ang ulat',
  'offline.banner': "You're offline. Reports saved on device.",
  'offline.banner_tl': 'Offline ka. Naka-save ang mga ulat sa device.',
  'offline.queued': 'Offline. {count} report(s) queued',
  'offline.queued_tl': 'Offline. {count} na ulat ang naka-queue',
  'lookup.secret_code_note': 'Your secret code is the key to your report.',
  'lookup.secret_code_note_tl': 'Ang iyong secret code ang susi sa iyong ulat.',
  'delete.title': 'Withdraw this report?',
  'delete.title_tl': 'I-withdraw ang ulat na ito?',
  'delete.body':
    'This keeps an audit record but removes the report from active review. Responders will no longer act on it.',
  'delete.body_tl':
    'May maiiwang audit record pero aalisin ang ulat sa active review. Hindi na ito aaksyunan ng responders.',
  'delete.keep': 'Keep Report',
  'delete.keep_tl': 'I-keep ang Ulat',
  'delete.confirm': 'Withdraw Report',
  'delete.confirm_tl': 'I-withdraw ang Ulat',
  'empty.no_incidents': 'No reported incidents',
  'empty.no_incidents_tl': 'Walang naiulat na insidente',
  'empty.no_updates': 'No updates yet',
  'empty.no_updates_tl': 'Wala pang update',
} as const

export function t(key: keyof typeof T): string {
  return T[key]
}
