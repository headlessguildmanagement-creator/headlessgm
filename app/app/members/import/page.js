import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { resolveGuild, withGuild } from '../../../../lib/guild-context'
import AppShell from '../../../../components/app-shell'
import { importRoster } from './actions'

export default async function RosterImportPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const params = await searchParams
  const guild = await resolveGuild(supabase, params?.guild, 'id,name,slug,owner_user_id,plan_code')
  if (!guild) redirect('/app/onboarding')

  const isOwner = guild.owner_user_id === userId
  const { data: access } = isOwner
    ? { data: { role: 'owner' } }
    : await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()
  if (!access) redirect('/app')
  if (guild.plan_code === 'free') redirect(`/${guild.slug}/members?error=Roster%20file%20import%20requires%20the%20GUILD%20plan.%20FREE%20uses%20manual%20entry.`)

  const [{ data: rules }, { data: jobs }] = await Promise.all([
    supabase.from('guild_auction_rules').select('feather_mode,puppet_mode').eq('guild_id', guild.id).maybeSingle(),
    supabase.from('game_jobs').select('label').eq('game_preset_id', 'rooc').eq('is_active', true).order('sort_order'),
  ])

  const columns = ['IGN', 'Class', 'CombatRole', 'GuildRank']
  if (rules?.feather_mode === 'four_group') columns.push('FeatherGroup')
  if (rules?.puppet_mode === 'round_robin') columns.push('PuppetOrder')

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} eyebrow="ROSTER" title="Import Members" activeHref="/app/members">
      {params?.error ? <div className="notice error">{String(params.error)}</div> : null}

      <section className="panel panel-pad">
        <div className="section-head">
          <div><h2>CSV / XML roster import</h2><p>Import is validated before any member is written. If one row fails, the whole import is rejected.</p></div>
          <Link href={withGuild('/app/members', guild.slug)} className="button ghost">Back to roster</Link>
        </div>

        <div className="notice" style={{ marginBottom: 16 }}>
          <strong>Required format for this guild</strong>
          <div className="muted" style={{ marginTop: 5 }}>{columns.join(', ')}</div>
          {rules?.feather_mode === 'four_group' ? <div className="muted">FeatherGroup is required and accepts 1-4 or A-D.</div> : null}
          {rules?.puppet_mode === 'round_robin' ? <div className="muted">PuppetOrder is optional; blank values are appended after the current queue in file order.</div> : null}
        </div>

        <form action={importRoster} className="form-grid">
          <input type="hidden" name="guild_id" value={guild.id} />
          <label className="field full"><span>Roster file · CSV or XML · max 2 MB</span><input type="file" name="roster_file" accept=".csv,text/csv,.xml,text/xml,application/xml" required /></label>
          <div className="full"><button type="submit" className="button">Validate & import roster</button></div>
        </form>
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>CSV guideline</h2><p>Use the exact header names below. Class accepts either the HeadlessGM job code or the displayed class name.</p></div></div>
        <pre style={{ overflow: 'auto', whiteSpace: 'pre', margin: 0, padding: 14, borderRadius: 10, background: 'var(--panel2)', border: '1px solid var(--line)' }}>{`${columns.join(',')}\nPixel,Gypsy,Support,Member${rules?.feather_mode === 'four_group' ? ',1' : ''}${rules?.puppet_mode === 'round_robin' ? ',1' : ''}\nNyx,Assassin Cross,DPS,Officer${rules?.feather_mode === 'four_group' ? ',2' : ''}${rules?.puppet_mode === 'round_robin' ? ',2' : ''}`}</pre>
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>XML guideline</h2><p>Wrap each roster entry in a &lt;member&gt; element.</p></div></div>
        <pre style={{ overflow: 'auto', whiteSpace: 'pre', margin: 0, padding: 14, borderRadius: 10, background: 'var(--panel2)', border: '1px solid var(--line)' }}>{`<guild>\n  <member>\n    <IGN>Pixel</IGN>\n    <Class>Gypsy</Class>\n    <CombatRole>Support</CombatRole>\n    <GuildRank>Member</GuildRank>${rules?.feather_mode === 'four_group' ? '\n    <FeatherGroup>1</FeatherGroup>' : ''}${rules?.puppet_mode === 'round_robin' ? '\n    <PuppetOrder>1</PuppetOrder>' : ''}\n  </member>\n</guild>`}</pre>
      </section>

      <section className="panel panel-pad">
        <div className="section-head"><div><h2>Allowed combat roles</h2><p>DPS · Support · Utility · Tank</p></div></div>
        <div className="muted">Recognized classes: {(jobs || []).map((job) => job.label).join(', ')}</div>
      </section>
    </AppShell>
  )
}
