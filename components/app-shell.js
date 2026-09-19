import Link from 'next/link'
import { headers } from 'next/headers'
import ThemeToggle from './theme-toggle'
import { withGuild } from '../lib/guild-context'
import { createClient } from '../lib/supabase/server'
import { commanderBrandStyle } from '../lib/brand.js'
import { hasPlanCapability } from '../lib/plans.mjs'

const nav = [
  ['Overview', '/app'],
  ['Members', '/app/members'],
  ['Events', '/app/events'],
  ['Auctions', '/app/auctions'],
  ['Recruitment', '/app/recruitment', 'publicRecruitment'],
  ['History', '/app/history'],
  ['Discord', '/app/settings/discord', 'discord'],
  ['Settings', '/app/settings'],
]

export default async function AppShell({ guildName = 'HeadlessGM', guildSlug = '', eyebrow = 'COMMAND CENTER', title, activeHref = '/app', children, actions = null }) {
  const requestHeaders = await headers()
  const effectiveSlug = guildSlug || requestHeaders.get('x-headlessgm-workspace-slug') || ''
  let shellGuild = null
  if (effectiveSlug) {
    const supabase = await createClient()
    shellGuild = (await supabase.from('guilds').select('name,slug,plan_code,logo_url,settings').eq('slug', effectiveSlug).maybeSingle()).data || null
  }

  const planCode = shellGuild?.plan_code || 'free'
  const brandStyle = commanderBrandStyle(planCode, shellGuild?.settings || {})
  const branded = ['commander','beta'].includes(String(planCode).toLowerCase())
  const showGuildLogo = shellGuild?.logo_url && planCode !== 'free'

  return (
    <div className={branded ? 'hgm-shell commander-branded' : 'hgm-shell'} style={brandStyle} data-plan={planCode}>
      <aside className="hgm-sidebar">
        <Link href={withGuild('/app', effectiveSlug)} className="hgm-brand">
          {showGuildLogo ? <img className="hgm-brand-logo" src={shellGuild.logo_url} alt="" /> : <span className="hgm-brand-mark">H</span>}
          <span><strong>{shellGuild?.name || guildName}</strong><small>{branded ? 'Powered by HeadlessGM' : 'HeadlessGM · Guild Operations'}</small></span>
        </Link>
        <nav className="hgm-nav">
          {nav.filter(([, , capability]) => !capability || hasPlanCapability(planCode, capability)).map(([label, href]) => (
            <Link key={`${label}-${href}`} href={withGuild(href, effectiveSlug)} className={activeHref === href ? 'active' : ''}>{label}</Link>
          ))}
        </nav>
        <div className="hgm-sidebar-foot"><span className="hgm-status-dot" /> HeadlessGM online · {String(planCode).toUpperCase()}</div>
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
