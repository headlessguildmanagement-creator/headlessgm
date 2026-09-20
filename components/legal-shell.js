import Link from 'next/link'
import ThemeToggle from './theme-toggle'

export default function LegalShell({ title, eyebrow = 'HEADLESSGM', children }) {
  return (
    <main className="legal-page">
      <header className="legal-nav">
        <Link href="/" className="marketing-brand">
          <span className="marketing-brand-mark">H</span>
          <span><strong>HEADLESSGM</strong><small>HEADLESS GUILD MANAGEMENT</small></span>
        </Link>
        <div className="legal-nav-links">
          <Link href="/support">Support</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/cookies">Cookies</Link>
          <ThemeToggle />
        </div>
      </header>
      <article className="legal-document">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </article>
    </main>
  )
}
