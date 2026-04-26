import { useParams, useNavigate } from 'react-router-dom'
import { useTriggerSOS } from '../hooks/useTriggerSOS'

export function SosPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { trigger, loading, error } = useTriggerSOS(id ?? '')

  async function handleConfirm() {
    try {
      await trigger()
      void navigate(`/dispatches/${id ?? ''}`)
    } catch {
      // error surfaced by hook
    }
  }

  return (
    <main>
      <h1>Confirm SOS</h1>
      <p style={{ color: 'red', fontWeight: 'bold' }}>
        WARNING: This will trigger an emergency SOS alert to dispatch control. Only use in genuine
        emergencies.
      </p>
      {error && <p style={{ color: 'red' }}>{error.message}</p>}
      <button
        onClick={() => {
          void handleConfirm()
        }}
        disabled={loading}
      >
        {loading ? 'Sending…' : 'Confirm SOS'}
      </button>
      <button
        onClick={() => {
          void navigate(`/dispatches/${id ?? ''}`)
        }}
        disabled={loading}
      >
        Cancel
      </button>
    </main>
  )
}
