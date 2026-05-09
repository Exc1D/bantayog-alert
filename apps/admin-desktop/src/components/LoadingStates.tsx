import styles from './LoadingStates.module.css'

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export function TableSkeleton({ rows = 6, columns = 5 }: TableSkeletonProps) {
  return (
    <div className={styles.tableSkeleton} data-testid="table-skeleton">
      <div className={styles.header}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className={styles.headerCell} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.row} data-testid="skeleton-row">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className={styles.cell} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function MapSkeleton() {
  return (
    <div className={styles.mapSkeleton} data-testid="map-skeleton">
      <svg
        data-testid="loading-icon"
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <p className={styles.text}>Loading map...</p>
    </div>
  )
}

export function ChartSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.chartSkeleton} data-testid="chart-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.card}>
          <div className={styles.title} />
          <div className={styles.chartArea}>
            <div className={styles.bar} data-testid="skeleton-bar" style={{ height: '40%' }} />
            <div className={styles.bar} data-testid="skeleton-bar" style={{ height: '70%' }} />
            <div className={styles.bar} data-testid="skeleton-bar" style={{ height: '55%' }} />
          </div>
          <div className={styles.footer} />
        </div>
      ))}
    </div>
  )
}
