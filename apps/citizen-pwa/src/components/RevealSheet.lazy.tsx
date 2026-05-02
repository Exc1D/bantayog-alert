import { lazy } from 'react'

export const RevealSheet = lazy(() =>
  import('./RevealSheet.js').then((m) => ({ default: m.RevealSheet })),
)
