import { useRef, useState } from 'react'
import { detectEncoding } from '@bantayog/shared-validators'
import { callables } from '../services/callables'

interface ReachPlan {
  route: 'direct' | 'ndrrmc_escalation'
  fcmCount: number
  smsCount: number
  segmentCount: number
  unicodeWarning: boolean
}

interface Props {
  municipalityId: string
  onClose: () => void
}

export function MassAlertModal({ municipalityId, onClose }: Props) {
  const sendKeyRef = useRef<string>(crypto.randomUUID())
  const escalateKeyRef = useRef<string>(crypto.randomUUID())
  const [message, setMessage] = useState('')
  const [reachPlan, setReachPlan] = useState<ReachPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagasaSignalRef, setPagasaSignalRef] = useState('')
  const [notes, setNotes] = useState('')

  const encoding = message ? detectEncoding(message).encoding : 'GSM-7'

  const handlePreview = () => {
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const plan = await callables.massAlertReachPlanPreview({
          targetScope: { municipalityIds: [municipalityId] },
          message,
        })
        setReachPlan(plan)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Preview failed')
      } finally {
        setLoading(false)
      }
    })()
  }

  const handleSend = () => {
    if (!reachPlan?.route || reachPlan.route !== 'direct') {
      setError('Direct send is not available for this alert scope')
      return
    }
    setLoading(true)
    void (async () => {
      try {
        await callables.sendMassAlert({
          reachPlan,
          message,
          targetScope: { municipalityIds: [municipalityId] },
          idempotencyKey: sendKeyRef.current,
        })
        onClose()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Send failed')
      } finally {
        setLoading(false)
      }
    })()
  }

  const handleEscalate = () => {
    setLoading(true)
    void (async () => {
      try {
        await callables.requestMassAlertEscalation({
          message,
          targetScope: { municipalityIds: [municipalityId] },
          evidencePack: {
            linkedReportIds: [],
            ...(pagasaSignalRef ? { pagasaSignalRef } : {}),
            ...(notes ? { notes } : {}),
          },
          idempotencyKey: escalateKeyRef.current,
        })
        onClose()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Escalation failed')
      } finally {
        setLoading(false)
      }
    })()
  }

  return (
    <dialog open aria-label="Mass Alert" aria-modal="true">
      <h3>Issue Mass Alert</h3>
      <p style={{ fontSize: 12, color: '#c00' }}>
        Every surface that references this flow must say &quot;Escalation submitted to NDRRMC&quot;
        — never &quot;Alert sent via ECBS.&quot;
      </p>
      {error && <p role="alert">{error}</p>}
      <label htmlFor="mass-alert-message">Message</label>
      <textarea
        id="mass-alert-message"
        value={message}
        onChange={(e) => {
          setMessage(e.target.value)
          setReachPlan(null)
          sendKeyRef.current = crypto.randomUUID()
          escalateKeyRef.current = crypto.randomUUID()
        }}
        rows={4}
      />
      <p>
        Encoding: <strong>{encoding}</strong>
        {reachPlan?.unicodeWarning && <span> ⚠ UCS-2 (multi-byte)</span>}
        {reachPlan && <> · Segments: {reachPlan.segmentCount}</>}
      </p>
      <button onClick={handlePreview} disabled={!message || loading}>
        Preview Reach
      </button>
      {reachPlan && (
        <div>
          <p>
            FCM recipients: {reachPlan.fcmCount} · SMS recipients: {reachPlan.smsCount}
          </p>
          {reachPlan.route === 'direct' ? (
            <strong>Direct</strong>
          ) : (
            <strong>NDRRMC escalation required</strong>
          )}
        </div>
      )}
      <button
        onClick={handleSend}
        disabled={!reachPlan?.route || reachPlan.route !== 'direct' || loading}
        aria-label="Send Alert"
      >
        Send Alert
      </button>
      {reachPlan?.route === 'ndrrmc_escalation' && (
        <>
          <label htmlFor="pagasa-signal-ref">PAGASA Signal Ref (optional)</label>
          <input
            id="pagasa-signal-ref"
            type="text"
            value={pagasaSignalRef}
            onChange={(e) => {
              setPagasaSignalRef(e.target.value)
            }}
          />
          <label htmlFor="escalation-notes">Notes (optional)</label>
          <textarea
            id="escalation-notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
            }}
            rows={2}
          />
          <button onClick={handleEscalate} disabled={loading}>
            Request NDRRMC Escalation
          </button>
        </>
      )}
      <button onClick={onClose}>Cancel</button>
    </dialog>
  )
}
