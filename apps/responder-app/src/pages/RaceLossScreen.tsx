import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import styles from './TerminalScreen.module.css'

export function RaceLossScreen() {
  const navigate = useNavigate()
  return (
    <div className={styles.page}>
      <div className={styles.icon} role="img" aria-label="Dispatch claimed by another responder">
        <Zap size={48} aria-hidden="true" />
      </div>
      <h1 className={styles.title}>Dispatch Already Claimed</h1>
      <p className={styles.text}>
        Another responder accepted this dispatch first. Stand by for the next one.
      </p>
      <button onClick={() => void navigate('/')} className={styles.backBtn}>
        Back to Dispatches
      </button>
    </div>
  )
}
