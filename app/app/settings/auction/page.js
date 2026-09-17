import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { saveAuctionRules } from './actions'

const field = { border: '1px solid #303742', borderRadius: 10, background: '#0b0d10', color: '#f5f7fa', padding: '12px 13px', width: '100%' }

export default async function AuctionSettingsPage({ searchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guild } = await supabase.from('guilds').select('id, name, owner_user_id, plan_code').limit(1).maybeSingle()
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

  return (
    <main style={{ minHeight: '100vh', padding: '40px 24px 72px' }}>
      <div style={{ width: 'min(900px, 100%)', margin: '0 auto', display: 'grid', gap: 24 }}>
        <header>
          <Link href="/app" style={{ color: '#8893a1', textDecoration: 'none' }}>← Dashboard</Link>
          <p className="eyebrow" style={{ marginTop: 20 }}>{guild.name}</p>
          <h1 style={{ fontSize: 48, lineHeight: 1 }}>Auction Rules</h1>
          <p className="lede">These are the guild defaults. Every auction run snapshots the rules it starts with, so changing settings later never changes historical auctions.</p>
        </header>

        {params?.error ? <div style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: 14, color: '#fca5a5' }}>{String(params.error)}</div> : null}
        {params?.success ? <div style={{ border: '1px solid #14532d', borderRadius: 12, padding: 14, color: '#86efac' }}>{String(params.success)}</div> : null}

        <form action={saveAuctionRules} style={{ display: 'grid', gap: 20 }}>
          <input type="hidden" name="guild_id" value={guild.id} />

          <section style={{ border: '1px solid #232832', borderRadius: 16, padding: 22, background: '#11151a', display: 'grid', gap: 16 }}>
            <div><strong>Feather allocation</strong><p style={{ color: '#8893a1', margin: '6px 0 0' }}>Determines the eligible pool before per-person caps are applied.</p></div>
            <select name="feather_mode" defaultValue={rules?.feather_mode || 'ffa'} style={field}>
              <option value="ffa">Free For All</option>
              <option value="four_group">4 Group Rotation</option>
              <option value="random">Random among eligible members</option>
              <option value="custom" disabled>Custom — COMMANDER</option>
            </select>
          </section>

          <section style={{ border: '1px solid #232832', borderRadius: 16, padding: 22, background: '#11151a', display: 'grid', gap: 16 }}>
            <div><strong>Puppet allocation</strong><p style={{ color: '#8893a1', margin: '6px 0 0' }}>Round Robin is persistent across events. New members are appended to the queue.</p></div>
            <select name="puppet_mode" defaultValue={rules?.puppet_mode || 'round_robin'} style={field}>
              <option value="ffa">Free For All</option>
              <option value="round_robin">Round Robin</option>
              <option value="random">Random among eligible members</option>
              <option value="custom" disabled>Custom — COMMANDER</option>
            </select>
          </section>

          <section style={{ border: '1px solid #232832', borderRadius: 16, padding: 22, background: '#11151a', display: 'grid', gap: 16 }}>
            <div>
              <strong>Per-person caps</strong>
              <p style={{ color: '#8893a1', margin: '6px 0 0' }}>Applied before Random/FFA/group/queue allocation and enforced again when allocations are written. Leave blank for no configured limit.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <label style={{ display: 'grid', gap: 7 }}><span>Light / Dark Feather</span><input name="light_dark_feather_cap" type="number" min="0" step="1" defaultValue={rules?.light_dark_feather_cap ?? ''} placeholder="Unlimited" style={field} /></label>
              <label style={{ display: 'grid', gap: 7 }}><span>Time / Space Feather</span><input name="time_space_feather_cap" type="number" min="0" step="1" defaultValue={rules?.time_space_feather_cap ?? ''} placeholder="Unlimited" style={field} /></label>
              <label style={{ display: 'grid', gap: 7 }}><span>Puppet Fragments</span><input name="puppet_fragment_cap" type="number" min="0" step="1" defaultValue={rules?.puppet_fragment_cap ?? ''} placeholder="Unlimited" style={field} /></label>
              <label style={{ display: 'grid', gap: 7 }}><span>Illusion Fragments</span><input name="illusion_fragment_cap" type="number" min="0" step="1" defaultValue={rules?.illusion_fragment_cap ?? ''} placeholder="Unlimited" style={field} /></label>
            </div>
          </section>

          <section style={{ border: '1px solid #232832', borderRadius: 16, padding: 22, background: '#11151a' }}>
            <strong>How Random works</strong>
            <p style={{ color: '#8893a1', lineHeight: 1.6, marginBottom: 0 }}>HeadlessGM first removes members who are unavailable or otherwise ineligible, then removes members who have reached the configured cap for that reward category, and only then randomizes among the remaining eligible members.</p>
          </section>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ color: '#727d8c', fontSize: 13 }}>Rule version {rules?.version || 1}</span>
            <button type="submit" style={{ border: 0, borderRadius: 10, padding: '12px 18px', fontWeight: 800, cursor: 'pointer' }}>Save auction rules</button>
          </div>
        </form>
      </div>
    </main>
  )
}
