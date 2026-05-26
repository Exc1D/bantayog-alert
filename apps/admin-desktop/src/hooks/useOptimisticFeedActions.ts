import { useState, useCallback } from 'react'

type ActionName = 'verify' | 'unpublish'

interface ReportStub {
  id: string
  status: string
}

interface Options<T extends ReportStub> {
  reports: T[]
  verifyReport?: (reportId: string) => Promise<unknown>
  unpublishReport?: (reportId: string) => Promise<unknown>
  onSuccess?: (reportId: string, action: ActionName) => void
  onError?: (reportId: string, error: Error) => void
}

function removeOptimisticState(
  prev: Record<string, string>,
  reportId: string,
): Record<string, string> {
  const { [reportId]: _removed, ...rest } = prev
  void _removed
  return rest
}

export function useOptimisticFeedActions<T extends ReportStub>({
  reports,
  verifyReport,
  unpublishReport,
  onSuccess,
  onError,
}: Options<T>) {
  const [optimisticState, setOptimisticState] = useState<Record<string, string>>({})
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const optimisticReports = reports.map((r) => {
    const optimisticStatus = optimisticState[r.id]
    return optimisticStatus ? { ...r, status: optimisticStatus } : r
  })

  const performOptimisticAction = useCallback(
    async (
      reportId: string,
      actionFn: ((reportId: string) => Promise<unknown>) | undefined,
      actionName: ActionName,
      optimisticStatus: string,
    ) => {
      if (!actionFn) return
      setOptimisticState((prev) => ({ ...prev, [reportId]: optimisticStatus }))
      setPendingIds((prev) => new Set(prev).add(reportId))

      try {
        await actionFn(reportId)
        setOptimisticState((prev) => removeOptimisticState(prev, reportId))
        onSuccess?.(reportId, actionName)
      } catch (err) {
        setOptimisticState((prev) => removeOptimisticState(prev, reportId))
        onError?.(reportId, err instanceof Error ? err : new Error(String(err)))
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(reportId)
          return next
        })
      }
    },
    [onSuccess, onError],
  )

  const optimisticVerify = useCallback(
    async (reportId: string) => {
      await performOptimisticAction(reportId, verifyReport, 'verify', 'verified')
    },
    [performOptimisticAction, verifyReport],
  )

  const optimisticUnpublish = useCallback(
    async (reportId: string) => {
      await performOptimisticAction(reportId, unpublishReport, 'unpublish', 'verified')
    },
    [performOptimisticAction, unpublishReport],
  )

  return { optimisticReports, optimisticVerify, optimisticUnpublish, pendingIds }
}
