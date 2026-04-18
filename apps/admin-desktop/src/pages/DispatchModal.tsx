// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DispatchModal({
  reportId,
  onClose,
  onError,
}: {
  reportId: string
  onClose: () => void
  onError: (msg: string) => void
}) {
  return (
    <div role="dialog">
      <p>DispatchModal coming in Task 17 for report {reportId}</p>
      <button onClick={onClose}>Close</button>
    </div>
  )
}
