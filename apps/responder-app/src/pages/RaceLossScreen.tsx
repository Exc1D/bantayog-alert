import { Link } from 'react-router-dom'

export function RaceLossScreen() {
  return (
    <main>
      <h1>This dispatch is no longer available</h1>
      <p>Another responder took this dispatch first.</p>
      <p>
        <Link to="/">Back to list</Link>
      </p>
    </main>
  )
}
