import styles from './App.module.css'
import { useCitizenShell } from './useCitizenShell.js'

export function App() {
  const state = useCitizenShell()

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>Bantayog Alert</p>
        <h1 className={styles.title}>Citizen Phase 1 shell</h1>
        <p className={styles.summary}>
          Pseudonymous sign-in, app health, and a hello-world alert feed.
        </p>

        <dl className={styles.meta}>
          <div>
            <dt>Status</dt>
            <dd>{state.status}</dd>
          </div>
          <div>
            <dt>Auth</dt>
            <dd>{state.authState}</dd>
          </div>
          <div>
            <dt>App Check</dt>
            <dd>{state.appCheckState}</dd>
          </div>
          <div>
            <dt>User UID</dt>
            <dd>{state.user?.uid ?? 'unavailable'}</dd>
          </div>
          <div>
            <dt>Minimum citizen version</dt>
            <dd>{state.minAppVersion?.citizen ?? 'unavailable'}</dd>
          </div>
        </dl>

        {state.error ? <p className={styles.error}>{state.error}</p> : null}

        <div className={styles.feed}>
          {state.alerts.map((alert) => (
            <article
              key={`${alert.publishedBy}-${String(alert.publishedAt)}`}
              className={styles.alert}
            >
              <h2>{alert.title}</h2>
              <p>{alert.body}</p>
              <span>{alert.severity}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
