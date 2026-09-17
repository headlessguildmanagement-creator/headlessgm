import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { addMember, updateMemberStatus } from './actions'

export default async function MembersPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()

  if (authError || !authData?.claims?.sub) {
    redirect('/login')
  }

  const { data: guildRows } = await supabase
    .from('guilds')
    .select('id, name, plan_code, game_preset_id')
    .order('created_at', { ascending: true })
    .limit(1)

  const guild = guildRows?.[0]
  if (!guild) {
    redirect('/app/onboarding')
  }

  const [{ data: plan }, { data: preset }, { data: members }] = await Promise.all([
    supabase.from('plans').select('display_name, active_member_limit').eq('code', guild.plan_code).single(),
    supabase.from('game_presets').select('name, max_active_members').eq('id', guild.game_preset_id).single(),
    supabase
      .from('guild_members')
      .select('id, ign, job_code, guild_role, status, is_officer, discord_user_id, created_at')
      .eq('guild_id', guild.id)
      .order('status', { ascending: true })
      .order('ign', { ascending: true }),
  ])

  const roster = members || []
  const activeCount = roster.filter((member) => member.status === 'active').length
  const pendingCount = roster.filter((member) => member.status === 'pending').length
  const limit = plan?.active_member_limit ?? preset?.max_active_members ?? 80
  const params = await searchParams
  const error = params?.error ? String(params.error) : ''
  const success = params?.success ? String(params.success) : ''

  return (
    <main style={{ minHeight: '100vh', padding: '36px 24px 64px' }}>
      <div style={{ width: 'min(1100px, 100%)', margin: '0 auto', display: 'grid', gap: 28 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <Link href="/app" style={{ color: '#8893a1', textDecoration: 'none', fontSize: 14 }}>← Dashboard</Link>
            <p className="eyebrow" style={{ marginTop: 18 }}>{guild.name}</p>
            <h1 style={{ fontSize: 52, lineHeight: 1, letterSpacing: '-0.04em' }}>Members</h1>
            <p className="lede" style={{ fontSize: 18, marginTop: 14 }}>
              HeadlessGM is the operational ROOC roster. Discord users are linked later; they are not automatically counted as guild members.
            </p>
          </div>

          <div style={{ border: '1px solid #232832', borderRadius: 14, padding: '16px 18px', minWidth: 180, background: '#11151a' }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{activeCount} / {limit}</div>
            <div style={{ color: '#8893a1', fontSize: 13 }}>Active members · {plan?.display_name || 'Beta'}</div>
            {pendingCount ? <div style={{ color: '#8893a1', fontSize: 13, marginTop: 4 }}>{pendingCount} pending</div> : null}
          </div>
        </header>

        {error ? <div style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: 14, color: '#fca5a5' }}>{error}</div> : null}
        {success ? <div style={{ border: '1px solid #14532d', borderRadius: 12, padding: 14, color: '#86efac' }}>{success}</div> : null}

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)', gap: 24, alignItems: 'start' }}>
          <div style={{ border: '1px solid #232832', borderRadius: 16, overflow: 'hidden', background: '#11151a' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #232832' }}>
              <strong>ROOC roster</strong>
              <div style={{ color: '#8893a1', fontSize: 13, marginTop: 4 }}>Inactive and left members retain history and do not count toward the active limit.</div>
            </div>

            {roster.length ? (
              <div style={{ display: 'grid' }}>
                {roster.map((member) => (
                  <div key={member.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(120px, .8fr) 110px auto', gap: 14, alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1d222b' }}>
                    <div>
                      <strong>{member.ign}</strong>
                      <div style={{ color: '#727d8c', fontSize: 12, marginTop: 3 }}>{member.discord_user_id ? 'Discord linked' : 'Discord not linked'}</div>
                    </div>
                    <div style={{ color: '#bbc3ce', fontSize: 14 }}>{member.job_code || 'Job not set'}</div>
                    <div style={{ color: member.status === 'active' ? '#86efac' : '#8893a1', fontSize: 13, textTransform: 'capitalize' }}>{member.status}</div>
                    <form action={updateMemberStatus} style={{ display: 'flex', gap: 8 }}>
                      <input type="hidden" name="guild_id" value={guild.id} />
                      <input type="hidden" name="member_id" value={member.id} />
                      <select name="status" defaultValue={member.status} style={{ border: '1px solid #303742', borderRadius: 9, background: '#0b0d10', color: '#f5f7fa', padding: '8px 10px' }}>
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                        <option value="left">Left</option>
                      </select>
                      <button type="submit" style={{ border: 0, borderRadius: 9, padding: '8px 10px', cursor: 'pointer' }}>Save</button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 28, color: '#8893a1' }}>No ROOC members yet. Add the first member manually, then Discord import will speed this up later.</div>
            )}
          </div>

          <aside style={{ display: 'grid', gap: 18 }}>
            <section style={{ border: '1px solid #232832', borderRadius: 16, padding: 20, background: '#11151a' }}>
              <strong>Add member</strong>
              <p style={{ color: '#8893a1', fontSize: 13, lineHeight: 1.5 }}>Manual entry is the fallback. Discord import will later let an officer select a Discord user and map them to IGN + job.</p>
              <form action={addMember} style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                <input type="hidden" name="guild_id" value={guild.id} />
                <input name="ign" required maxLength={80} placeholder="ROOC IGN" style={{ border: '1px solid #303742', borderRadius: 10, background: '#0b0d10', color: '#f5f7fa', padding: '12px 13px' }} />
                <input name="job_code" placeholder="Job / class" style={{ border: '1px solid #303742', borderRadius: 10, background: '#0b0d10', color: '#f5f7fa', padding: '12px 13px' }} />
                <input name="guild_role" placeholder="Guild role (optional)" style={{ border: '1px solid #303742', borderRadius: 10, background: '#0b0d10', color: '#f5f7fa', padding: '12px 13px' }} />
                <select name="status" defaultValue="active" style={{ border: '1px solid #303742', borderRadius: 10, background: '#0b0d10', color: '#f5f7fa', padding: '12px 13px' }}>
                  <option value="active">Active in-game member</option>
                  <option value="pending">Pending / recruit</option>
                </select>
                <button type="submit" style={{ border: 0, borderRadius: 10, padding: '12px 14px', fontWeight: 800, cursor: 'pointer' }}>Add to HeadlessGM</button>
              </form>
            </section>

            <section style={{ border: '1px dashed #303742', borderRadius: 16, padding: 20 }}>
              <strong>Import from Discord</strong>
              <p style={{ marginBottom: 0, color: '#727d8c', fontSize: 13, lineHeight: 1.5 }}>Next integration step: connect a Discord server, list candidates, then explicitly choose which users belong to the ROOC roster.</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
