import React from 'react'

interface FallbackCardsProps {
  hotlineNumber: string
  emphasized?: boolean
  onCallClick?: () => void
  onSmsClick?: () => void
}

export function FallbackCards({
  hotlineNumber,
  emphasized = false,
  onCallClick,
  onSmsClick,
}: FallbackCardsProps) {
  const baseCard = 'flex-1 border rounded-lg p-3 text-center'
  const emphasizedCard = emphasized ? 'border-[#fca5a5] bg-[#fff5f5]' : 'border-[#e5e7eb] bg-white'

  return (
    <div className="grid grid-cols-2 gap-2">
      <button onClick={onCallClick} className={`${baseCard} ${emphasizedCard}`}>
        <div className="w-8 h-8 rounded-full bg-[#001e40] text-white flex items-center justify-center mx-auto mb-1">
          &#9742;
        </div>
        <div className="font-semibold text-[#001e40] text-sm">Call</div>
        <div className="text-[10px] text-[#52606d]">{hotlineNumber}</div>
      </button>
      <button onClick={onSmsClick} className={`${baseCard} ${emphasizedCard}`}>
        <div className="w-8 h-8 rounded-full bg-[#001e40] text-white flex items-center justify-center mx-auto mb-1">
          &#9993;
        </div>
        <div className="font-semibold text-[#001e40] text-sm">SMS</div>
        <div className="text-[10px] text-[#52606d]">No data needed</div>
      </button>
    </div>
  )
}
