import { useLocation, Link } from 'react-router-dom'

export function ReceiptScreen() {
  const { state } = useLocation() as { state: { publicRef: string; secret: string } | null }
  if (!state) return <p>No submission to display.</p>
  return (
    <section aria-label="Submission receipt">
      <h1>Report submitted</h1>
      <p>Save these two values. You will need them to check status.</p>
      <dl>
        <dt>Reference</dt>
        <dd>
          <code>{state.publicRef}</code>
        </dd>
        <dt>Secret</dt>
        <dd>
          <code>{state.secret}</code>
        </dd>
      </dl>
      <p>
        We&apos;ll notify you when we can. For now, check back with your reference number via the{' '}
        <Link to="/lookup">lookup page</Link>.
      </p>
    </section>
  )
}
