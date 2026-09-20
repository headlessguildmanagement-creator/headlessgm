import Link from 'next/link'
import LegalShell from '../../../components/legal-shell'

export const metadata = { title: 'Terms and Conditions' }

export default function TermsPage() {
  return (
    <LegalShell title="Terms and Conditions">
      <p className="legal-updated">Last updated: September 20, 2026</p>
      <p>These Terms govern access to and use of HeadlessGM, including guild workspaces, public recruitment tools, Discord integrations, billing-linked features and related services. By creating or using a HeadlessGM account or workspace, you agree to these Terms.</p>
      <h2>1. Accounts and guild workspaces</h2>
      <p>You are responsible for the accuracy of information submitted to HeadlessGM, protecting access to your account, and the actions of people you authorize as guild owners or officers. A guild workspace is separated from other workspaces by its internal guild identifier. Do not attempt to access another guild’s data or bypass role, plan or security controls.</p>
      <h2>2. Plans and paid access</h2>
      <p>FREE, GUILD and COMMANDER provide different capabilities. Paid functionality is available only while the applicable entitlement is active. A cancellation does not normally remove already-paid access before the provider-confirmed end of the billing period. When a paid entitlement ends, paid features may be suspended while stored guild data and configuration are retained.</p>
      <p>COMMANDER-only configuration may remain stored after a downgrade but will not continue executing or rendering as a COMMANDER feature until COMMANDER access is restored. Likewise, Discord automation, public recruitment and other paid services are suspended when the current plan no longer includes them.</p>
      <h2>3. Billing</h2>
      <p>Lemon Squeezy acts as merchant of record for paid HeadlessGM purchases. Prices, taxes, invoices, payment processing, subscription renewals and payment-method handling are processed through Lemon Squeezy. HeadlessGM uses verified provider events to determine paid access and does not rely on a browser return page to grant a paid plan.</p>
      <p>Changing plans may result in prorated charges, credits, or a change taking effect at a future renewal depending on the type of change and the billing provider’s confirmed state.</p>
      <h2>3A. Limited Launch 30 offer</h2>
      <p>When displayed as available, the Launch 30 introductory offer is limited to the first 30 successfully paid eligible HeadlessGM guild subscriptions. Opening checkout may temporarily reserve a slot, but a slot is permanently claimed only after successful payment. HeadlessGM may close the offer when all slots are claimed or otherwise withdraw the promotion before purchase.</p>
      <p>The Launch 30 offer is a prepaid three-month promotional term. The first three months are charged together at checkout at the advertised introductory amount. Unless future renewal is cancelled, the launch subscription then renews every three months at the standard three-month equivalent price displayed before purchase. Cancelling future renewal does not shorten the already-paid promotional term.</p>
      <p>The offer is limited to new paid customers, one redemption per eligible account, guild and billing customer, and may not be combined with creator codes, referral discounts, credits or other promotions. Promotional rights have no cash value, are not transferable between guilds or accounts, and a paid redemption remains counted toward the 30-slot limit even if the guild is later deleted, suspended, cancelled, refunded or charged back.</p>
      <p>Upgrades or changes during the prepaid term may be subject to the normal subscription-change rules and provider charges. Attempts to create duplicate accounts, recycle guilds, manipulate payment identities or otherwise circumvent the slot limit may result in cancellation of promotional eligibility.</p>
      <h2>4. Refund policy</h2>
      <p>HeadlessGM does not offer routine partial, prorated or usage-based refunds. A customer who cancels may request a full refund within three calendar days after the applicable payment, whether or not the account has been used. A request made on days four through seven may be approved only when there has been no meaningful HeadlessGM account or guild activity during that day-four-through-day-seven period. Requests after day seven are not eligible for a voluntary HeadlessGM refund.</p>
      <p>Meaningful activity includes creating or changing operational guild data, using paid automation, configuring or publishing Discord operations, operating recruitment workflows, creating or managing events or auctions, using paid imports/exports, or changing paid-plan configuration. A login by itself is not treated as meaningful activity.</p>
      <p>Refund requests are reviewed through <Link href="/support">HeadlessGM Support</Link>. Approved refunds are processed through Lemon Squeezy. Fraud, duplicate charges, chargebacks, payment errors, mandatory consumer rights, or a refund independently required or issued by the merchant of record may be handled separately from this voluntary policy.</p>
      <h2>5. Acceptable use</h2>
      <p>You may not probe, scrape, reverse engineer, overload, exploit, circumvent subscription controls, automate abusive requests, misuse public application endpoints, impersonate another person, upload malicious material, or use HeadlessGM in violation of law or third-party rights. HeadlessGM may rate-limit, suspend or terminate access reasonably necessary to protect the service, customers or infrastructure.</p>
      <h2>6. Guild and applicant data</h2>
      <p>Guild owners and authorized officers control operational data submitted to their workspace. Applicants remain applicants unless separately accepted into a roster; an application does not automatically create guild membership. Finalized or published historical records may be treated as immutable to preserve the integrity of guild history.</p>
      <h2>7. Integrations</h2>
      <p>Third-party services such as Discord, Lemon Squeezy, Supabase and hosting infrastructure have their own terms and availability. Reconnecting Discord changes the integration destination; it does not by itself reset HeadlessGM guild history. Existing Discord messages may remain in Discord after HeadlessGM access changes, but HeadlessGM-powered interactions may be disabled when the current plan does not include Discord integration.</p>
      <h2>8. Availability and changes</h2>
      <p>We may improve, secure, modify or discontinue features. We aim to preserve customer data when plans change, but no online service can guarantee uninterrupted availability. Material changes to these Terms will be reflected by an updated effective date and, where appropriate, additional notice.</p>
      <h2>9. Intellectual property</h2>
      <p>HeadlessGM software, branding, interface, documentation and service design remain the property of HeadlessGM and its licensors. You retain rights you otherwise hold in guild data and content you submit, subject to the limited processing needed to provide, secure and maintain the service.</p>
      <h2>10. Disclaimers and liability</h2>
      <p>HeadlessGM is provided on an “as available” basis to the extent permitted by applicable law. To the maximum extent permitted by law, HeadlessGM is not liable for indirect, incidental, special or consequential loss arising from service interruption, third-party services, user configuration or unauthorized account use. Mandatory consumer rights are not excluded.</p>
      <h2>11. Governing rules</h2>
      <p>These Terms are subject to the laws applicable to the HeadlessGM contracting entity and the customer, including any mandatory consumer-protection rules that cannot legally be waived. Before public commercial launch, HeadlessGM may update this section with the formal contracting entity and jurisdiction.</p>
      <h2>12. Contact</h2>
      <p>Questions, account issues, legal notices and refund requests can be started through <Link href="/support">Contact Support</Link>.</p>
    </LegalShell>
  )
}
