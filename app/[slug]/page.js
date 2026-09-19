import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import { commanderBrandStyle } from '../../lib/brand.js'

export default async function GuildRecruitmentLanding({ params }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_public_recruitment_page', { p_guild_slug: String(slug).toLowerCase() })
  if (error || !data?.guild) notFound()

  const guild = data.guild
  const recruitment = data.recruitment || {}
  const commander = ['commander','beta'].includes(String(guild.plan_code))
  const style = commanderBrandStyle(guild.plan_code, guild.settings || {})
  const remaining = Math.max(0, Number(guild.active_member_limit || 0) - Number(guild.active_members || 0))

  return (
    <main className={commander ? 'recruitment-site commander-branded' : 'recruitment-site'} style={style}>
      <header className="recruitment-site-nav">
        <div className="recruitment-site-brand">
          {guild.logo_url ? <img src={guild.logo_url} alt={`${guild.name} logo`} /> : <span className="hgm-brand-mark">H</span>}
          <div><strong>{guild.name}</strong><small>{commander ? 'Powered by HeadlessGM' : 'Guild recruitment · HeadlessGM'}</small></div>
        </div>
        <Link className="button" href={`/${guild.slug}/apply`}>Apply now</Link>
      </header>

      <section className="recruitment-hero">
        <div>
          <p className="eyebrow">NOW RECRUITING</p>
          <h1>{recruitment.title || `Join ${guild.name}`}</h1>
          <p>{recruitment.intro || `${guild.name} uses HeadlessGM to keep applications, events, attendance, lineups and guild operations organized from day one.`}</p>
          <div className="marketing-hero-actions">
            <Link className="button marketing-primary" href={`/${guild.slug}/apply`}>{recruitment.is_open ? 'Apply to the guild' : 'View recruitment status'}</Link>
          </div>
        </div>
        <aside className="recruitment-capacity panel">
          <p className="eyebrow">ROSTER</p>
          <strong>{guild.active_members} / {guild.active_member_limit}</strong>
          <span>{remaining > 0 ? `${remaining} guild slot${remaining === 1 ? '' : 's'} currently available` : 'Roster is currently at capacity'}</span>
          <div className="recruitment-capacity-bar"><i style={{ width: `${Math.min(100, (Number(guild.active_members || 0) / Math.max(1, Number(guild.active_member_limit || 1))) * 100)}%` }} /></div>
        </aside>
      </section>

      <section className="recruitment-public-grid">
        <article><span>01</span><h2>Apply once</h2><p>Your application gets a private portal and stays attached to the same recruitment record throughout officer review.</p></article>
        <article><span>02</span><h2>Stay updated</h2><p>See application status and officer feedback without chasing a Discord message thread.</p></article>
        <article><span>03</span><h2>Join organized</h2><p>Accepted applicants can carry their Discord identity into the guild roster and HeadlessGM operations.</p></article>
      </section>

      <section className="recruitment-final">
        <p className="eyebrow">{guild.name.toUpperCase()}</p>
        <h2>{recruitment.is_open ? 'Think you fit the guild?' : 'Recruitment is currently closed.'}</h2>
        <p>{recruitment.is_open ? 'Submit your application and keep the whole review in one place.' : 'You can still check an existing application through the applicant portal.'}</p>
        <Link className="button" href={`/${guild.slug}/apply`}>{recruitment.is_open ? 'Start application' : 'Open applicant portal'}</Link>
      </section>
    </main>
  )
}
