/**
 * Performance budget thresholds for Bantayog Alert App.
 * These budgets ensure the app remains fast and responsive for disaster scenarios
 * where users may be on slow networks or stressed devices.
 */

export const PERFORMANCE_BUDGETS = {
  // Bundle size budgets (bytes)
  bundleSize: 500 * 1024, // 500KB main bundle
  totalJs: 1024 * 1024, // 1MB total JS

  // Core Web Vitals (milliseconds)
  firstContentfulPaint: 2000, // 2s
  timeToInteractive: 5000, // 5s
  largestContentfulPaint: 2500, // 2.5s

  // Layout stability
  cumulativeLayoutShift: 0.1,

  // Resource timing (milliseconds)
  totalBlockingTime: 300, // 300ms

  // Operation timing (milliseconds)
  photoUpload: 30000, // 30s
  reportSubmission: 10000, // 10s
} as const;

export type PerformanceBudget = typeof PERFORMANCE_BUDGETS;
