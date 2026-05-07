import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'

export function PrivacyNoticePage() {
  const navigate = useNavigate()

  return (
    <main id="main-content" className="min-h-[100dvh] bg-surface-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b bg-white border-surface-200 sticky top-0 z-nav">
        <button
          type="button"
          onClick={() => {
            void navigate(-1)
          }}
          className="p-0 border-none bg-transparent cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="text-surface-800" />
        </button>
        <div>
          <h1 className="m-0 font-semibold text-lg text-surface-900">Privacy Notice</h1>
          <p className="m-0 text-xs text-surface-500">Patakaran sa Pagkapribado</p>
        </div>
      </div>

      <div className="max-w-prose mx-auto px-4 py-6 space-y-6">
        {/* RA 10173 badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 rounded-lg border border-brand-200">
          <Shield size={16} className="text-brand-600 shrink-0" />
          <span className="text-xs font-medium text-brand-700">
            Compliant with RA 10173 — Data Privacy Act of 2012
          </span>
        </div>

        {/* What is collected */}
        <section aria-labelledby="collected-heading">
          <h2 id="collected-heading" className="text-base font-semibold text-surface-900 mb-2">
            What we collect
          </h2>
          <ul className="space-y-2 text-sm text-surface-700 list-none p-0 m-0">
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>
                <strong>Pseudonymous UID</strong> — a random device identifier, not linked to your
                name by default.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>
                <strong>GPS location</strong> — only when you tap &quot;Use my location&quot; or
                enable auto-detect. Never collected silently.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>
                <strong>Report content</strong> — incident type, description, barangay, and optional
                patient count.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>
                <strong>Photos</strong> — voluntarily attached images. EXIF stripped (GPS
                coordinates removed) before storage.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>
                <strong>IP address</strong> — retained short-term in server logs (standard Firebase
                infrastructure).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>
                <strong>Phone number hash</strong> (optional) — a one-way cryptographic hash of your
                number if you choose to provide it. We cannot reverse this to your number.
              </span>
            </li>
          </ul>
        </section>

        {/* What is NOT collected */}
        <section aria-labelledby="not-collected-heading">
          <h2 id="not-collected-heading" className="text-base font-semibold text-surface-900 mb-2">
            What we do NOT collect
          </h2>
          <ul className="space-y-2 text-sm text-surface-700 list-none p-0 m-0">
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>Continuous background location or movement history</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>Contacts, calendar, messages, or any other app data</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>Payment or financial information</span>
            </li>
          </ul>
        </section>

        {/* Anonymity disclaimer */}
        <section
          aria-labelledby="anonymity-heading"
          className="bg-amber-50 border border-amber-200 rounded-xl p-4"
        >
          <h2 id="anonymity-heading" className="text-base font-semibold text-surface-900 mb-2">
            Anonymity is not absolute
          </h2>
          <p className="text-sm text-surface-700 leading-relaxed m-0">
            We design for privacy, but anonymity is not absolute. Court orders and Firebase
            infrastructure logs may retain identifying signals such as IP addresses. If legally
            compelled, we comply with Philippine law.
          </p>
          <p className="text-xs text-surface-500 mt-2 italic">
            Ang aming sistema ay idinisenyo para sa privacy, ngunit hindi ganap na anonymous. Ang
            mga court order at server logs ay maaaring maglaman ng mga identifier.
          </p>
        </section>

        {/* Retention */}
        <section aria-labelledby="retention-heading">
          <h2 id="retention-heading" className="text-base font-semibold text-surface-900 mb-2">
            Data retention
          </h2>
          <ul className="space-y-2 text-sm text-surface-700 list-none p-0 m-0">
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>
                <strong>Reports</strong> — retained until resolved, then deleted after a 30-day
                grace period.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>
                <strong>Account data</strong> — retained until you request deletion via
                &ldquo;Delete My Account.&rdquo;
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-surface-400" aria-hidden="true">
                •
              </span>
              <span>
                <strong>Wizard drafts</strong> — stored locally on your device for 24 hours, then
                deleted automatically. Never uploaded until you submit.
              </span>
            </li>
          </ul>
        </section>

        {/* Right to erasure */}
        <section aria-labelledby="erasure-heading">
          <h2 id="erasure-heading" className="text-base font-semibold text-surface-900 mb-2">
            Your rights (RA 10173)
          </h2>
          <p className="text-sm text-surface-700 leading-relaxed">
            Under the Data Privacy Act of 2012, you have the right to access, correct, and erase
            your personal data. To exercise your right to erasure:
          </p>
          <a
            href="/profile"
            className="inline-flex items-center mt-3 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg no-underline min-h-[44px]"
          >
            Delete My Account
          </a>
          <p className="text-xs text-surface-500 mt-2 italic">
            Ang iyong karapatan sa pagpapabura ng data ay protektado ng RA 10173.
          </p>
        </section>

        {/* Contact */}
        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="text-base font-semibold text-surface-900 mb-2">
            Data Protection Officer
          </h2>
          <p className="text-sm text-surface-700">
            For privacy concerns, contact the Camarines Norte MDRRMO at{' '}
            <a href="mailto:privacy@bantayog.gov.ph" className="text-brand-600 underline">
              privacy@bantayog.gov.ph
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-surface-400 text-center pb-4">
          Last updated: May 2026 · Bantayog Alert
        </p>
      </div>
    </main>
  )
}
