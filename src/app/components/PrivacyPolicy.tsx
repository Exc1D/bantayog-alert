const PRIVACY_EMAIL = import.meta.env.VITE_PRIVACY_EMAIL || 'privacy@bantayogalert.gov.ph'

export function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-600">
          <strong>Bantayog Alert</strong>
        </p>
        <p className="text-gray-600">Last Updated: April 11, 2026</p>
        <p className="text-gray-600">Version: 1.0</p>
      </header>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Data We Collect</h2>

        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-800 mb-2">When You Submit a Report</h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Photos/Videos:</strong> Evidence of the incident (optional)</li>
            <li><strong>Location:</strong> Where the incident happened (GPS or manual)</li>
            <li><strong>Description:</strong> What you observed</li>
            <li><strong>Contact Information:</strong> Phone number (required) and email (optional)</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-800 mb-2">When You Create an Account</h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Name:</strong> Your display name</li>
            <li><strong>Phone Number:</strong> For verification and notifications</li>
            <li><strong>Email:</strong> For account recovery (optional)</li>
            <li><strong>Municipality & Barangay:</strong> Your location in Camarines Norte</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Technical Data</h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Device Information:</strong> Browser type, OS version</li>
            <li><strong>Usage Data:</strong> Which features you use, when you use them</li>
            <li><strong>Location Data:</strong> Approximate location for relevant alerts</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Data</h2>

        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Primary Purpose</h3>
          <p className="text-gray-700 mb-2">To coordinate disaster response in Camarines Norte by:</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Verifying and triaging incident reports</li>
            <li>Dispatching emergency responders</li>
            <li>Sending official alerts and warnings</li>
            <li>Improving response times through data analysis</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Legal Basis</h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Consent:</strong> You explicitly agree when submitting reports</li>
            <li><strong>Legitimate Interest:</strong> Coordinating emergency response</li>
            <li><strong>Legal Requirement:</strong> Compliance with disaster response laws</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Who Can See Your Data</h2>

        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Public (Everyone)</h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Report Content:</strong> What happened (no personal info)</li>
            <li><strong>Photos:</strong> After verification (no faces/identifying info)</li>
            <li><strong>Location:</strong> Approximate (barangay level, not exact address)</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Administrators (MDRRMO Staff)</h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>All Report Data:</strong> Including contact info for follow-up</li>
            <li><strong>Your Identity:</strong> Even for anonymous reports (legal compliance)</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Responders (Emergency Services)</h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Report Content:</strong> What and where</li>
            <li><strong>NO Contact Info:</strong> Privacy protection</li>
          </ul>
        </div>

        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-red-800 mb-2">NEVER Shared Publicly</h3>
          <ul className="list-disc pl-6 space-y-1 text-red-700">
            <li>Your name</li>
            <li>Your phone number</li>
            <li>Your email</li>
            <li>Your exact address</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Pseudonymous Reporting</h2>
        <p className="text-gray-700 mb-2">When you choose not to display your name:</p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-4">
          <li><strong>Hidden From:</strong> Public, responders, municipal admins</li>
          <li><strong>Visible To:</strong> Provincial superadmins (legal compliance only)</li>
          <li><strong>Exception:</strong> Court order can reveal identity (legal requirement)</li>
        </ul>
        <div className="bg-amber-50 p-4 rounded-lg">
          <p className="text-amber-800 font-medium mb-2">Important:</p>
          <p className="text-amber-700">Your phone number is still stored for:</p>
          <ol className="list-decimal pl-6 space-y-1 text-amber-700 mt-2">
            <li>Follow-up questions about the incident</li>
            <li>Legal compliance (court orders)</li>
            <li>Fraud prevention (abuse detection)</li>
          </ol>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Retention</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Data Type</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">How Long We Keep It</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700">Verified reports</td>
                <td className="px-4 py-2 text-sm text-gray-700">Forever (public record)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700">Unverified reports</td>
                <td className="px-4 py-2 text-sm text-gray-700">6 months, then auto-deleted</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700">Anonymous reports</td>
                <td className="px-4 py-2 text-sm text-gray-700">1 year (analytics only)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700">Account data</td>
                <td className="px-4 py-2 text-sm text-gray-700">Until you delete your account</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700">Contact logs</td>
                <td className="px-4 py-2 text-sm text-gray-700">1 year</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700">Location data</td>
                <td className="px-4 py-2 text-sm text-gray-700">Same as report</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-800 mb-2">After Deletion:</h3>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Your name, email, phone are deleted</li>
            <li>Verified reports remain (public record)</li>
            <li>Unverified reports are anonymized ("Citizen" instead of name)</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights (Data Privacy Act)</h2>

        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-800 mb-2">1. Right to Access</h3>
          <p className="text-gray-700 mb-2">You can request a copy of all data we have about you.</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>How:</strong> Profile → Download My Data</li>
            <li><strong>Format:</strong> JSON file</li>
            <li><strong>Timeline:</strong> Within 24 hours</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-800 mb-2">2. Right to Correct</h3>
          <p className="text-gray-700 mb-2">You can update your account information anytime.</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>How:</strong> Profile → Edit Profile</li>
            <li><strong>Changes:</strong> Immediate</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-800 mb-2">3. Right to Erasure (Article 17)</h3>
          <p className="text-gray-700 mb-2">You can delete your account and personal data.</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>How:</strong> Profile → Delete Account</li>
            <li><strong>What's Deleted:</strong> Name, email, phone</li>
            <li><strong>What's Anonymized:</strong> Verified reports become 'Anonymous Citizen' (public record cannot be removed)</li>
            <li><strong>Timeline:</strong> Immediate for account, 30 days for data</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-800 mb-2">4. Right to Object</h3>
          <p className="text-gray-700 mb-2">You can object to how we use your data.</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>How:</strong> Email {PRIVACY_EMAIL}</li>
            <li><strong>Response:</strong> Within 15 days</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">5. Right to File a Complaint</h3>
          <p className="text-gray-700 mb-2">You can file a complaint with the National Privacy Commission.</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Website:</strong> https://privacy.gov.ph</li>
            <li><strong>Email:</strong> complaints@privacy.gov.ph</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Security</h2>
        <p className="text-gray-700 mb-2">We protect your data with:</p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-4">
          <li><strong>Encryption:</strong> All data encrypted in transit and at rest</li>
          <li><strong>Access Controls:</strong> Only authorized staff can access personal data</li>
          <li><strong>Audit Logs:</strong> All data access is logged</li>
          <li><strong>Regular Audits:</strong> Security reviewed quarterly</li>
        </ul>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-blue-800">
            <strong>Data Breaches:</strong> If your data is exposed, we will notify you within 72 hours via email and push notification where contact information is still available. We will also post a notice on our website.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
        <p className="text-gray-700 mb-4">We use these services to run Bantayog Alert:</p>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Service</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Purpose</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Data Shared</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700">Firebase (Google)</td>
                <td className="px-4 py-2 text-sm text-gray-700">Database, hosting</td>
                <td className="px-4 py-2 text-sm text-gray-700">All data (encrypted)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700">Firebase Cloud Messaging</td>
                <td className="px-4 py-2 text-sm text-gray-700">Push notifications</td>
                <td className="px-4 py-2 text-sm text-gray-700">Device token only</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700">Leaflet</td>
                <td className="px-4 py-2 text-sm text-gray-700">Maps</td>
                <td className="px-4 py-2 text-sm text-gray-700">Map tiles loaded from external servers; location coordinates you provide</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-gray-700 mt-4">All services comply with data privacy standards.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Children's Privacy</h2>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-800 font-medium mb-2">You must be 13 years or older to use this app.</p>
        </div>
        <p className="text-gray-700 mt-4 mb-2">If we discover a child under 13 has submitted a report:</p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700">
          <li>We will delete their account and personal data</li>
          <li>We will keep the report (important for emergency response)</li>
          <li>If contact information is available, we may attempt to notify parents/guardians</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
        <p className="text-gray-700 mb-2">We may update this policy. We will notify you of significant changes via:</p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-4">
          <li>In-app notification</li>
          <li>Email (if provided)</li>
          <li>Push notification</li>
        </ul>
        <p className="text-gray-600">Last Updated: April 11, 2026</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
        <p className="text-gray-700 mb-2">Questions about this policy?</p>
        <ul className="list-disc pl-6 space-y-1 text-gray-700 mb-4">
          <li>
            Email: <a href={`mailto:${PRIVACY_EMAIL}`} className="text-blue-600 underline">{PRIVACY_EMAIL}</a>
          </li>
          <li>MDRRMO Office: Contact your local MDRRMO for office details</li>
        </ul>
      </section>

      <footer className="border-t border-gray-200 pt-6 mt-8">
        <p className="text-sm text-gray-600 text-center">
          This policy is written in plain language as required by the Data Privacy Act of 2012 (Republic Act No. 10173).
        </p>
      </footer>
    </div>
  )
}
