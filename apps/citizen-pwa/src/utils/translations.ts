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
  'delete.title': 'Delete this report?',
  'delete.title_tl': 'I-delete ang ulat na ito?',
  'delete.body':
    'This will permanently remove your report from the map. Responders will no longer see it.',
  'delete.body_tl':
    'Permanenteng mawawala ang iyong ulat sa mapa. Hindi na ito makikita ng mga responder.',
  'delete.keep': 'Keep Report',
  'delete.keep_tl': 'I-keep ang Ulat',
  'delete.confirm': 'Delete Report',
  'delete.confirm_tl': 'I-delete ang Ulat',
  'empty.no_incidents': 'No reported incidents',
  'empty.no_incidents_tl': 'Walang naiulat na insidente',
  'empty.no_updates': 'No updates yet',
  'empty.no_updates_tl': 'Wala pang update',
} as const

export function t(key: keyof typeof T): string {
  return T[key]
}
