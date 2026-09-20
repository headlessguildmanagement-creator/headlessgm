import Link from 'next/link'
import LegalShell from '../../../components/legal-shell'

export const metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p className="legal-updated">Last updated: September 20, 2026</p>
      <p>This Privacy Policy explains how HeadlessGM processes information when you use our website, guild workspaces, applicant portals, Discord integration and paid services.</p>
      <h2>Information we process</h2>
      <p>We may process account identifiers and authentication information; guild names, roles and settings; roster and character information; event, attendance, lineup, auction and reward records; recruitment applications and applicant messages; Discord identifiers and integration configuration; support communications; subscription status and provider identifiers; technical logs; and security or abuse-prevention information.</p>
      <p>HeadlessGM does not need to store your full payment-card number. Payment checkout and card processing are handled by Lemon Squeezy as merchant of record.</p>
      <h2>Why we process information</h2>
      <p>We use information to authenticate users, isolate guild workspaces, provide requested product features, operate Discord and recruitment workflows, maintain billing entitlements, provide support, protect the service from fraud or abuse, troubleshoot incidents, preserve finalized guild history, and meet legal obligations.</p>
      <h2>Guild owners, members and applicants</h2>
      <p>Guild owners and officers may enter information about guild members and may review applicant information. Guild administrators are responsible for using those tools appropriately and for having a lawful basis to submit information about other people. Applicants are not treated as guild members unless separately accepted into the roster.</p>
      <h2>Service providers and integrations</h2>
      <p>HeadlessGM uses service providers to operate the platform, including Supabase for database/authentication infrastructure, Vercel for application hosting, Discord for connected guild interactions, and Lemon Squeezy for paid subscription transactions. These providers process information according to their own terms and privacy commitments and only to the extent necessary for the applicable service.</p>
      <h2>Billing information</h2>
      <p>HeadlessGM receives subscription and transaction metadata needed to identify the guild entitlement, such as provider customer/subscription identifiers, product or variant, payment status, billing period, renewal/end dates and limited customer information. Lemon Squeezy handles payment-card processing, tax and merchant-of-record functions.</p>
      <h2>Retention</h2>
      <p>Operational guild data may remain stored while a workspace is inactive or downgraded so that a later reactivation restores prior configuration and history. Downgrading does not automatically delete guild data. Finalized historical records may be retained to preserve audit and operational integrity. We may retain security, billing and legal records for the period reasonably required for fraud prevention, disputes, accounting or compliance.</p>
      <h2>Cookies and local storage</h2>
      <p>We use essential session/security storage and local preferences needed to operate the service. HeadlessGM currently does not set analytics or advertising cookies. See the <Link href="/legal/cookies">Cookie Policy</Link> and <Link href="/cookie-settings">Cookie Settings</Link>.</p>
      <h2>Security</h2>
      <p>We use tenant identifiers, authorization checks, signed provider webhooks, role controls and other safeguards designed to prevent unauthorized access. No Internet service can guarantee absolute security. Never send passwords, API keys, webhook secrets or other credentials through support messages.</p>
      <h2>Your choices and requests</h2>
      <p>Depending on applicable law, you may have rights to request access, correction, deletion, restriction, portability or objection concerning personal information. Some information may need to be retained for security, transaction, legal or immutable-history reasons. Submit privacy requests through <Link href="/support">Contact Support</Link>.</p>
      <h2>International processing</h2>
      <p>HeadlessGM and its service providers may process information in countries different from your own. Where required, appropriate contractual or legal safeguards may apply.</p>
      <h2>Children</h2>
      <p>HeadlessGM is intended for people able to lawfully agree to these terms or use the service with appropriate authorization. Do not knowingly submit personal information of a child where doing so would violate applicable law.</p>
      <h2>Changes and contact</h2>
      <p>We may update this Policy as the product or legal requirements change. The date above identifies the current version. Privacy questions can be sent through <Link href="/support">HeadlessGM Support</Link>.</p>
    </LegalShell>
  )
}
