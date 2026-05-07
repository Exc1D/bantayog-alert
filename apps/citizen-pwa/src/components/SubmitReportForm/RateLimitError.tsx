import { Phone } from 'lucide-react'

const BARANGAY_HOTLINE = import.meta.env.VITE_BARANGAY_HOTLINE ?? 'tel:+63-054-440-1234'

export function RateLimitError() {
  return (
    <div
      role="alert"
      className="mx-5 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3"
    >
      <p className="text-sm font-semibold text-surface-900 m-0">
        You&apos;ve reached the report limit for now. Try again in a few minutes.
      </p>
      <p className="text-xs text-surface-600 m-0">
        For urgent help, call your barangay hotline directly.
      </p>
      <p className="text-xs text-surface-500 italic m-0">
        Naabot mo na ang limitasyon ng ulat. Para sa tulong, makipag-ugnayan sa iyong barangay.
      </p>
      <a
        href={BARANGAY_HOTLINE}
        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg no-underline min-h-[44px]"
        aria-label="Call Barangay Hotline"
      >
        <Phone size={14} aria-hidden="true" />
        Call Barangay Hotline
      </a>
    </div>
  )
}
