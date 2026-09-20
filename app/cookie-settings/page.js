import LegalShell from '../../components/legal-shell'
import { CookieSettingsPanel } from '../../components/cookie-consent'

export const metadata = { title: 'Cookie Settings' }

export default function CookieSettingsPage() {
  return (
    <LegalShell title="Cookie Settings" eyebrow="PRIVACY CONTROLS">
      <p>Choose whether HeadlessGM may remember optional interface preferences. Essential authentication and security storage remains active because the service cannot operate correctly without it.</p>
      <CookieSettingsPanel />
    </LegalShell>
  )
}
