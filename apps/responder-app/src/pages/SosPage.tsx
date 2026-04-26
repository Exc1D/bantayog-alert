import { useParams, useNavigate } from 'react-router-dom'
import { useTriggerSOS } from '../hooks/useTriggerSOS'

export function SosPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { trigger, loading, error } = useTriggerSOS(id ?? '')

  if (!id) {
    return <div role="alert">Invalid route: dispatch ID is missing.</div>
  }
  const dispatchId = id

  async function handleConfirm() {
    try {
      await trigger()
      void navigate(`/dispatches/${dispatchId}`)
    } catch (err: unknown) {
      console.error('[SosPage] triggerSOS failed:', err)
    }
  }

  return (
    <main>
      <h1>Confirm SOS</h1>
      <p style={{ color: 'red', fontWeight: 'bold' }}>
        WARNING: This will trigger an emergency SOS alert to dispatch control. Only use in genuine
        emergencies.
      </p>
      {error && (
        <p role="alert" aria-live="assertive" style={{ color: 'red' }}>
          Unable to trigger SOS. Please try again.
        </p>
      )}
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
          void navigate(`/dispatches/${dispatchId}`)
        }}
        disabled={loading}
      >
        Cancel
      </button>
    </main>
  )
}
