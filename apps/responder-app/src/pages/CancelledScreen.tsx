import { useNavigate } from 'react-router-dom'
import type { DispatchDoc } from '../hooks/useDispatch'
import styles from './TerminalScreen.module.css'

interface CancelledScreenProps {
  dispatch: DispatchDoc
}

export function CancelledScreen({ dispatch }: CancelledScreenProps) {
  const navigate = useNavigate()
  const reason = dispatch.cancelReason
  return (
    <div className={styles.page}>
      <div className={styles.icon} aria-hidden="true">
        ✕
      </div>
      <h1 className={styles.title}>Dispatch Cancelled</h1>
      <p className={styles.text}>
        {reason !== undefined && reason !== ''
          ? `This dispatch has been cancelled. Reason: ${reason}`
          : 'This dispatch has been cancelled by the admin.'}
      </p>
      <button onClick={() => void navigate('/')} className={styles.backBtn}>
        Back to Dispatches
      </button>
    </div>
  )
}
