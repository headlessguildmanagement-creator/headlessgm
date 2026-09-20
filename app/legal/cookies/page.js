import Link from 'next/link'
import LegalShell from '../../../components/legal-shell'

export const metadata = { title: 'Cookie Policy' }

export default function CookiePolicyPage() {
  return (
    <LegalShell title="Cookie Policy">
      <p className="legal-updated">Last updated: September 20, 2026</p>
      <p>This policy explains the cookies and browser storage HeadlessGM uses. “Cookies” below also includes similar browser storage where appropriate.</p>
      <h2>Essential storage</h2>
      <p>Essential storage supports login/session continuity, authentication, security, request routing and remembering your cookie choice. These functions are necessary to provide a signed-in HeadlessGM workspace and cannot be disabled through our preference controls.</p>
      <h2>Preference storage</h2>
      <p>HeadlessGM may store preferences you deliberately select, such as interface/theme choices. Preference storage is not used to build advertising profiles.</p>
      <h2>Analytics and advertising</h2>
      <p>HeadlessGM currently does not set analytics cookies, advertising cookies or cross-site marketing cookies. If this changes, the Cookie Policy and settings interface will be updated before optional categories are enabled where consent is required.</p>
      <h2>Third-party services</h2>
      <p>When you leave HeadlessGM for a third-party service such as Discord or Lemon Squeezy, that provider may use its own cookies or storage under its own policies. HeadlessGM does not control storage set directly on another provider’s domain.</p>
      <h2>Managing choices</h2>
      <p>You can review or change HeadlessGM cookie preferences at any time in <Link href="/cookie-settings">Cookie Settings</Link>. You can also clear browser cookies/local storage using your browser controls, although doing so may sign you out or reset saved preferences.</p>
    </LegalShell>
  )
}
