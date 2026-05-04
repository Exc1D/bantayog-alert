const PH_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Manila',
}

export function formatDateTime(date: Date | number): string {
  return new Date(date).toLocaleString('en-PH', {
    ...PH_OPTIONS,
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
