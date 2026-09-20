import Link from 'next/link'
import LegalShell from '../../components/legal-shell'

export const metadata = { title: 'Support' }

export default function SupportPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'headlessguildmanagement@gmail.com'
  const subject = encodeURIComponent('HeadlessGM Support Request')
  const body = encodeURIComponent('Type: Bug / Account / Billing / Discord / Other\nGuild/workspace: \nWhat happened: \nSteps to reproduce: \nExpected result: \n\nPlease do not include passwords, API keys, webhook secrets, recovery codes, or payment-card details.')
  const href = 'mailto:' + supportEmail + '?subject=' + subject + '&body=' + body

  return (
    <LegalShell title="Contact Support" eyebrow="HELP & SUPPORT">
      <p>Use support for bugs, account access, billing/subscription problems, Discord integration issues, privacy requests or anything that is preventing HeadlessGM from working as expected.</p>
      <div className="support-grid">
        <section className="panel panel-pad"><h2>Bug or unexpected behavior</h2><p>Include the workspace name, page, what you clicked, what happened, and the expected result. Screenshots are useful.</p></section>
        <section className="panel panel-pad"><h2>Account or billing</h2><p>Include the workspace name and a description of the issue. Do not send card details or secret credentials. Refund eligibility is reviewed under the <Link href="/legal/terms">Terms and Conditions</Link>.</p></section>
        <section className="panel panel-pad"><h2>Discord integration</h2><p>Include the Discord server name, the HeadlessGM action you attempted and any error message shown. Never send the bot token or Discord application secret.</p></section>
      </div>
      <a className="button support-primary" href={href}>Email HeadlessGM Support</a>
      <p className="muted">Support email: {supportEmail}</p>
    </LegalShell>
  )
}
