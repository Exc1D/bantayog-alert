import { Award } from 'lucide-react'
import type { BadgeDef } from '../useProfileTab'

interface BadgeListProps {
  badges: BadgeDef[]
  title?: string
}

export function BadgeList({ badges, title = 'Guardian Skills' }: BadgeListProps) {
  return (
    <div className="mx-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Award size={16} className="text-brand-500" />
        <h2 className="text-sm font-semibold text-surface-700">{title}</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border transition-opacity ${
              badge.earned
                ? 'bg-white border-surface-200 shadow-sm'
                : 'bg-surface-100 border-surface-200 opacity-40'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                badge.earned ? 'bg-brand-100' : 'bg-surface-200'
              }`}
            >
              <badge.Icon
                size={16}
                className={badge.earned ? 'text-brand-500' : 'text-surface-400'}
              />
            </div>
            <div>
              <p
                className={`text-xs font-semibold ${badge.earned ? 'text-surface-900' : 'text-surface-400'}`}
              >
                {badge.label}
              </p>
              <p className="text-[10px] text-surface-400">{badge.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
