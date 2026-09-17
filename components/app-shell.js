import Link from 'next/link'
import ThemeToggle from './theme-toggle'

const nav = [
  ['Overview', '/app'],
  ['Events', '/app/events'],
  ['Lineup Builder', '/app/events'],
  ['Leave of Absence', '/app/events'],
  ['Recruitment', '/app/recruitment'],
  ['Auction Rules', '/app/settings/auction'],
  ['Members', '/app/members'],
  ['Discord', '/app/settings/discord'],
  ['Settings', '/app/settings'],
]

export default function AppShell({ guildName = 'HeadlessGM', eyebrow = 'COMMAND CENTER', title, activeHref = '/app', children, actions = null }) {
  return (
    <div className="hgm-shell">
      <aside className="hgm-sidebar">
        <Link href="/app" className="hgm-brand">
          <span className="hgm-brand-mark">H</span>
          <span><strong>{guildName}</strong><small>Guild Operations</small></span>
        </Link>
        <nav className="hgm-nav">
          {nav.map(([label, href]) => (
            <Link key={`${label}-${href}`} href={href} className={activeHref === href ? 'active' : ''}>{label}</Link>
          ))}
        </nav>
        <div className="hgm-sidebar-foot"><span className="hgm-status-dot" /> HeadlessGM online</div>
      </aside>

      <main className="hgm-main">
        <header className="hgm-topbar">
          <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
          <div className="hgm-top-actions">{actions}<ThemeToggle /></div>
        </header>
        <section className="hgm-content">{children}</section>
      </main>
    </div>
  )
}
