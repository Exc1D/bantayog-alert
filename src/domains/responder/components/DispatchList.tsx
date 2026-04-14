import { useDispatches } from '../hooks/useDispatches'
import { useQuickStatus } from '../hooks/useQuickStatus'
import type { AssignedDispatch } from '../types'

interface DispatchListProps {
  onDispatchClick?: (dispatch: AssignedDispatch) => void
}

export function DispatchList({ onDispatchClick }: DispatchListProps) {
  const { dispatches, isLoading, error } = useDispatches({ subscribe: true })
  const { updateStatus, isUpdating, pendingStatus } = useQuickStatus()

  if (isLoading) {
    return <DispatchListSkeleton />
  }

  if (error?.code === 'PERMISSION_DENIED' || error?.code === 'AUTH_EXPIRED') {
    return (
      <div className="p-4 text-center">
        <h2 className="text-lg font-semibold text-red-600">Session Expired</h2>
        <p className="text-gray-600 mt-2">{error.message}</p>
        <button
          onClick={() => window.location.href = '/login'}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Sign In
        </button>
      </div>
    )
  }

  if (dispatches.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-4">📍</div>
        <h3 className="text-lg font-semibold text-gray-700">No Active Dispatches</h3>
        <p className="text-gray-500 mt-2">You have no assigned dispatches at the moment.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {dispatches.map((dispatch) => (
        <DispatchCard
          key={dispatch.id}
          dispatch={dispatch}
          onUpdateStatus={(status) => updateStatus(dispatch.id, status)}
          isUpdating={isUpdating}
          isPending={pendingStatus.has(dispatch.id)}
          onClick={() => onDispatchClick?.(dispatch)}
        />
      ))}
    </div>
  )
}

// Simple skeleton loader
function DispatchListSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}

// Individual dispatch card component
interface DispatchCardProps {
  dispatch: AssignedDispatch
  onUpdateStatus: (status: 'en_route' | 'on_scene' | 'needs_assistance' | 'completed') => void
  isUpdating: boolean
  isPending: boolean
  onClick?: () => void
}

function DispatchCard({ dispatch, onUpdateStatus, isUpdating, isPending, onClick }: DispatchCardProps) {
  const urgencyColors = {
    high: 'border-red-500 bg-red-50',
    medium: 'border-yellow-500 bg-yellow-50',
    low: 'border-green-500 bg-green-50'
  }

  return (
    <div
      className={`border-l-4 rounded-lg p-4 ${urgencyColors[dispatch.urgency]} ${isPending ? 'opacity-70' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold capitalize">{dispatch.type.replace('_', ' ')}</h4>
          <p className="text-sm text-gray-600">
            {dispatch.incidentLocation.address || 'Location pending...'}
          </p>
          {dispatch.incidentLocation.landmark && (
            <p className="text-xs text-gray-500">Near: {dispatch.incidentLocation.landmark}</p>
          )}
        </div>
        <span className={`
          px-2 py-1 rounded text-xs font-medium
          ${dispatch.status === 'en_route' ? 'bg-blue-100 text-blue-700' :
            dispatch.status === 'on_scene' ? 'bg-green-100 text-green-700' :
            dispatch.status === 'needs_assistance' ? 'bg-orange-100 text-orange-700' :
            'bg-yellow-100 text-yellow-700'}
        `}>
          {dispatch.status.replace('_', ' ')}
        </span>
      </div>

      {isPending && (
        <div className="mt-2 text-sm text-blue-600">Updating...</div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus('en_route'); }}
          disabled={isUpdating || isPending}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          En Route
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus('on_scene'); }}
          disabled={isUpdating || isPending}
          className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          On Scene
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus('needs_assistance'); }}
          disabled={isUpdating || isPending}
          className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
        >
          Help
        </button>
      </div>
    </div>
  )
}
