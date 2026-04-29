export function GoodbyeScreen() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '360px' }}>
        <h1>Request submitted</h1>
        <p>
          Your deletion request has been submitted. You have been signed out. You will not receive
          further notifications.
        </p>
      </div>
    </main>
  )
}
