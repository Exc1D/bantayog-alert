import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { fns } from '../services/firebase.js'

interface LookupResult {
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

export function LookupScreen() {
  const [publicRef, setPublicRef] = useState('')
  const [secret, setSecret] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.SubmitEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setResult(null)
    try {
      const res = await httpsCallable(fns(), 'requestLookup')({ publicRef, secret })
      setResult(res.data as LookupResult)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'lookup failed')
    }
  }

  return (
    <section aria-label="Report status lookup">
      <h1>Check report status</h1>
      <form
        onSubmit={(e) => {
          void handleSubmit(e)
        }}
      >
        <label>
          Reference
          <input
            value={publicRef}
            onChange={(e) => {
              setPublicRef(e.target.value)
            }}
            required
          />
        </label>
        <label>
          Secret
          <input
            value={secret}
            onChange={(e) => {
              setSecret(e.target.value)
            }}
            required
          />
        </label>
        <button type="submit">Look up</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && (
        <dl>
          <dt>Status</dt>
          <dd>{result.status}</dd>
          <dt>Municipality</dt>
          <dd>{result.municipalityLabel}</dd>
          <dt>Last update</dt>
          <dd>{new Date(result.lastStatusAt).toLocaleString()}</dd>
        </dl>
      )}
    </section>
  )
}
