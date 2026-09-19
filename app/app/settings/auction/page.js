import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { resolveGuild } from '../../../../lib/guild-context'
import AppShell from '../../../../components/app-shell'
import { saveAuctionRules } from './actions'

export default async function AuctionSettingsPage({ searchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const guild = await resolveGuild(supabase, params?.guild, 'id, name, slug, owner_user_id, plan_code')
  if (!guild) redirect('/app/onboarding')

  const isOwner = guild.owner_user_id === userId
  const { data: membership } = isOwner
    ? { data: { role: 'owner' } }
    : await supabase.from('guild_users').select('role').eq('guild_id', guild.id).eq('user_id', userId).in('role', ['owner', 'officer']).maybeSingle()
  if (!membership) redirect('/app')

  const { data: rules } = await supabase
    .from('guild_auction_rules')
    .select('feather_mode, puppet_mode, light_dark_feather_cap, time_space_feather_cap, puppet_fragment_cap, illusion_fragment_cap, version, updated_at')
    .eq('guild_id', guild.id)
    .maybeSingle()

  const commander = guild.plan_code === 'commander' || guild.plan_code === 'beta'

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} title="Auction Rules" activeHref="/app/settings/auction">
      {params?.error ? <div className="notice error">{String(params.error)}</div> : null}
      {params?.success ? <div className="notice success">{String(params.success)}</div> : null}

      <form action={saveAuctionRules} style={{ display: 'grid', gap: 18 }}>
        <input type="hidden" name="guild_id" value={guild.id} />

        <section className="panel panel-pad">
          <div className="section-head"><div><h2>Allocation presets</h2><p>Choose how eligibility is organized before caps are applied.</p></div><span className="pill">Rule version {rules?.version || 1}</span></div>
          <div className="form-grid">
            <label className="field"><span>Feather allocation</span><select name="feather_mode" defaultValue={rules?.feather_mode || 'ffa'}><option value="ffa">Free For All</option><option value="four_group">4 Group Rotation</option><option value="random">Random among eligible members</option><option value="custom" disabled={!commander}>Custom — COMMANDER</option></select></label>
            <label className="field"><span>Puppet allocation</span><select name="puppet_mode" defaultValue={rules?.puppet_mode || 'round_robin'}><option value="ffa">Free For All</option><option value="round_robin">Round Robin</option><option value="random">Random among eligible members</option><option value="custom" disabled={!commander}>Custom — COMMANDER</option></select></label>
          </div>
          {!commander ? <p className="muted" style={{ marginBottom: 0 }}>Custom allocation logic is available on COMMANDER. Standard presets remain editable here.</p> : null}
        </section>

        <section className="panel panel-pad">
          <div className="section-head"><div><h2>Per-person reward caps</h2><p>Random, FFA, group allocation, Puppet cycles and Feather officer excess all obey these limits. Officer excess never bypasses a cap.</p></div></div>
          <div className="form-grid">
            <label className="field"><span>Light / Dark Feather</span><input name="light_dark_feather_cap" type="number" min="0" step="1" defaultValue={rules?.light_dark_feather_cap ?? ''} placeholder="Unlimited" /></label>
            <label className="field"><span>Time / Space Feather</span><input name="time_space_feather_cap" type="number" min="0" step="1" defaultValue={rules?.time_space_feather_cap ?? ''} placeholder="Unlimited" /></label>
            <label className="field"><span>Puppet Fragments</span><input name="puppet_fragment_cap" type="number" min="0" step="1" defaultValue={rules?.puppet_fragment_cap ?? ''} placeholder="Unlimited" /></label>
            <label className="field"><span>Illusion Fragments</span><input name="illusion_fragment_cap" type="number" min="0" step="1" defaultValue={rules?.illusion_fragment_cap ?? ''} placeholder="Unlimited" /></label>
          </div>
        </section>

        <section className="panel panel-pad">
          <div className="section-head"><div><h2>Havoc / ROOC persistent rules</h2><p>When the standard ROOC preset is used, HeadlessGM keeps the persistent operating state instead of rebuilding it per event.</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>Rule</th><th>Behavior</th></tr></thead><tbody>
            <tr><td>Puppet Round Robin</td><td>A–Z queue, per-cycle DONE/PENDING state, deferred make-ups, approved appeals, Cannot Bid and 96-hour eligibility. State advances only on finalization.</td></tr>
            <tr><td>4 Group Feather</td><td>Calendar-driven group selection, combined L/D + T/S fairness, No Gold / 96H exclusions, then persistent officer excess rotation under the same caps.</td></tr>
            <tr><td>Midnight completion</td><td>Generated past events are reconciled at 12:00 AM PHT so persistent state cannot remain stranded when an officer forgets to finalize.</td></tr>
          </tbody></table></div>
        </section>

        <section className="panel panel-pad">
          <div className="section-head"><div><h2>Random allocation order</h2><p>This is deterministic in rules, not in winner choice.</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>Step</th><th>Rule</th></tr></thead><tbody><tr><td>1</td><td>Start with the event-eligible members for that reward.</td></tr><tr><td>2</td><td>Remove LOA, no-show, unavailable or reward-ineligible members.</td></tr><tr><td>3</td><td>Remove anyone already at the configured category cap.</td></tr><tr><td>4</td><td>Randomize only within the remaining eligible pool.</td></tr><tr><td>5</td><td>Enforce the cap again when allocations are written.</td></tr></tbody></table></div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="button">Save auction rules</button></div>
      </form>
    </AppShell>
  )
}
