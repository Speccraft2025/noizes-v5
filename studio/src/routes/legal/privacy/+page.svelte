<svelte:head><title>Privacy Policy — Noizes</title></svelte:head>

<h1>Privacy Policy</h1>
<span class="effective-date">Effective date: 11 August 2026</span>

<p>
  This Privacy Policy explains how <strong>Speccraft Media Ltd.</strong>
  ("<strong>Speccraft</strong>", "<strong>we</strong>", "<strong>us</strong>")
  collects, uses, stores, and shares your personal information when you use the
  Noizes platform at noizes.xyz and related services (the "<strong>Platform</strong>").
</p>

<h2>1. Information We Collect</h2>

<h3>1.1 Account Information</h3>
<p>When you create an account we collect:</p>
<ul>
  <li>Email address</li>
  <li>Password (stored as a cryptographic hash — we never store plaintext passwords)</li>
  <li>Display name, avatar, bio, and location (optional, provided by you)</li>
  <li>Account role (Creator or Collector)</li>
</ul>

<h3>1.2 Identity Verification (Creators Only)</h3>
<p>
  If you register as a Creator, we collect additional identity information to
  comply with applicable law and to prevent fraud:
</p>
<ul>
  <li>Full legal name</li>
  <li>Country of residence</li>
  <li>Government-issued ID type, number, and a photograph of the document</li>
  <li>A selfie for identity matching</li>
  <li>Artist/stage name</li>
  <li>Social media and music platform links</li>
  <li>Years active as a creator</li>
</ul>
<p>
  Identity documents are stored in a private, access-restricted storage bucket
  and are only accessible to authorised Noizes review personnel.
</p>

<h3>1.3 Payment Information</h3>
<p>
  When you make a purchase, payment is processed by <strong>Paystack</strong>.
  We do not store your full card number or M-Pesa PIN. We receive and store:
</p>
<ul>
  <li>Transaction reference and status</li>
  <li>Amount and currency</li>
  <li>Payment channel (card or M-Pesa)</li>
  <li>Date and time of payment</li>
</ul>

<h3>1.4 Content &amp; Activity Data</h3>
<ul>
  <li><strong>Creators:</strong> Music files, artwork, lyrics, credits, rights declarations, and release metadata you upload to Noizes Studio.</li>
  <li><strong>Collectors:</strong> Acquisition records, transfer history, resale offers, and collector notes you write.</li>
  <li><strong>Provenance data:</strong> Every ownership event (acquisition, transfer, resale) is recorded in a public, hash-chained provenance ledger associated with each edition.</li>
</ul>

<h3>1.5 Aggregate Analytics</h3>
<p>
  We collect <strong>aggregate, non-identifying</strong> analytics on Drop Pages
  (e.g. total page views, share clicks, download counts per day). We do
  <strong>not</strong> collect individual visitor identifiers, IP addresses,
  device fingerprints, or any personally identifiable information for analytics
  purposes.
</p>

<h3>1.6 Waitlist</h3>
<p>
  If you sign up for our waitlist, we collect your email address and your
  preferred role (Creator or Collector).
</p>

<h3>1.7 Local Storage (Your Device Only)</h3>
<p>
  Certain data is stored only on your device and is never sent to our servers:
</p>
<ul>
  <li>Draft release data in Noizes Studio (stored in IndexedDB)</li>
  <li>Listener interaction state within <code>.nz</code> experiences (stored in localStorage)</li>
  <li>Authentication session tokens (stored in cookies)</li>
</ul>

<h2>2. How We Use Your Information</h2>
<table>
  <thead>
    <tr><th>Purpose</th><th>Legal Basis</th></tr>
  </thead>
  <tbody>
    <tr><td>Provide and operate the Platform</td><td>Contract performance</td></tr>
    <tr><td>Process payments and maintain transaction records</td><td>Contract performance</td></tr>
    <tr><td>Verify Creator identity (KYC)</td><td>Legal obligation / Legitimate interest (fraud prevention)</td></tr>
    <tr><td>Maintain the provenance ledger</td><td>Contract performance / Legitimate interest</td></tr>
    <tr><td>Send transactional emails (invitations, purchase confirmations)</td><td>Contract performance</td></tr>
    <tr><td>Improve the Platform and fix bugs</td><td>Legitimate interest</td></tr>
    <tr><td>Enforce our Terms and policies</td><td>Legitimate interest</td></tr>
    <tr><td>Comply with applicable law</td><td>Legal obligation</td></tr>
  </tbody>
</table>

<h2>3. How We Share Your Information</h2>
<p>We do not sell your personal information. We share data only as follows:</p>
<ul>
  <li><strong>Service providers:</strong> We use Supabase (database and authentication hosting), Paystack (payment processing), Resend (transactional email), and Netlify (website hosting). Each provider processes data on our behalf under contractual obligations to protect your information.</li>
  <li><strong>Public provenance:</strong> When you acquire, transfer, or resell an edition, your display name and the event details are recorded in the edition's provenance chain, which is visible to other users.</li>
  <li><strong>Creator profiles:</strong> If you are a Creator, your artist name, bio, avatar, and links are publicly visible on your Drop Pages.</li>
  <li><strong>Legal requirements:</strong> We may disclose information if required by law, regulation, legal process, or governmental request.</li>
  <li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</li>
</ul>

<h2>4. Data Retention</h2>
<ul>
  <li><strong>Account data:</strong> Retained for as long as your account is active. Upon account deletion, personal profile data is deleted within 30 days, but provenance records (which are part of the public ledger) are retained permanently.</li>
  <li><strong>KYC documents:</strong> Retained for a minimum of 5 years after account closure, as required by applicable anti-money-laundering regulations, then securely deleted.</li>
  <li><strong>Payment records:</strong> Retained for 7 years for tax and accounting compliance.</li>
  <li><strong>Waitlist data:</strong> Retained until you are invited or request removal.</li>
</ul>

<h2>5. Data Security</h2>
<p>
  We use industry-standard measures to protect your data, including:
</p>
<ul>
  <li>Encryption in transit (TLS/HTTPS for all connections)</li>
  <li>Encryption at rest for sensitive data (AES-256-GCM for cryptographic signing keys)</li>
  <li>Private storage buckets with access controls for identity documents</li>
  <li>Row-level security (RLS) policies on our database, ensuring users can only access their own data</li>
  <li>Hashed passwords (managed by Supabase Auth)</li>
</ul>
<p>
  No system is perfectly secure. If we become aware of a data breach affecting
  your personal information, we will notify you and the relevant authorities as
  required by applicable law.
</p>

<h2>6. Your Rights</h2>
<p>
  Depending on your jurisdiction, you may have the following rights regarding
  your personal data:
</p>
<ul>
  <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
  <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
  <li><strong>Deletion:</strong> Request deletion of your personal data, subject to our legal retention obligations.</li>
  <li><strong>Portability:</strong> Request your data in a structured, commonly used, machine-readable format.</li>
  <li><strong>Restriction:</strong> Request that we restrict processing of your data in certain circumstances.</li>
  <li><strong>Objection:</strong> Object to processing based on legitimate interests.</li>
  <li><strong>Withdraw consent:</strong> Where processing is based on consent, withdraw it at any time.</li>
</ul>
<p>
  To exercise any of these rights, contact us at
  <a href="mailto:privacy@noizes.xyz">privacy@noizes.xyz</a>. We will respond
  within 30 days.
</p>

<h2>7. International Data Transfers</h2>
<p>
  Our service providers may process data in countries outside Kenya. Where
  personal data is transferred to a jurisdiction that does not provide an
  adequate level of data protection, we ensure appropriate safeguards are in
  place (such as standard contractual clauses or the provider's certified
  compliance frameworks).
</p>

<h2>8. Children's Privacy</h2>
<p>
  Noizes is not intended for anyone under 18 years of age. We do not knowingly
  collect personal information from children. If we learn that we have collected
  information from a child, we will delete it promptly.
</p>

<h2>9. Changes to This Policy</h2>
<p>
  We may update this Privacy Policy from time to time. We will notify you of
  material changes by email or by posting a notice on the Platform at least
  fourteen (14) days before the changes take effect.
</p>

<h2>10. Contact</h2>
<p>
  For privacy-related questions or requests:
</p>
<p>
  <strong>Speccraft Media Ltd.</strong><br />
  Data Protection Contact<br />
  Email: <a href="mailto:privacy@noizes.xyz">privacy@noizes.xyz</a>
</p>
