import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/server'
import { approveClaim, rejectClaim } from './actions'

async function requireManager(supabase, guildId, userId) {
  const { data: guild } = await supabase.from('guilds').select('id, name, owner_user_id').eq('id', guildId).single()
  if (!guild) redirect('/app')
  if (guild.owner_user_id === userId) return guild
  const { data: membership } = await supabase.from('guild_users').select('role').eq('guild_id', guildId).eq('user_id', userId).in('role', ['owner', 'officer']).maybeSingle()
  if (!membership) redirect('/app')
  return guild
}

export default async function ClaimsPage({ searchParams }) {
  const params = await searchParams
  const guildId = String(params?.guild || '')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const guild = await requireManager(supabase, guildId, userId)
  const { data: claims, error } = await supabase
    .from('discord_character_claims')
    .select('id, guild_id, guild_member_id, discord_user_id, discord_username, discord_display_name, status, requested_at, reviewed_at, rejection_reason, guild_members(ign, job_code, status)')
    .eq('guild_id', guild.id)
    .order('requested_at', { ascending: true })

  const pending = (claims || []).filter((claim) => claim.status === 'pending')
  const recent = (claims || []).filter((claim) => claim.status !== 'pending').slice(-10).reverse()

  return (
    <main style={{ minHeight: '100vh', padding: '40px 24px 72px' }}>
      <div style={{ width: 'min(1100px, 100%)', margin: '0 auto', display: 'grid', gap: 24 }}>
        <header>
          <Link href="/app/settings/discord" style={{ color: '#8893a1', textDecoration: 'none' }}>← Discord settings</Link>
          <p className="eyebrow" style={{ marginTop: 20 }}>{guild.name}</p>
          <h1 style={{ fontSize: 48, lineHeight: 1 }}>Character claims</h1>
          <p className="lede">Review Discord identity claims against the existing HeadlessGM roster. Approval writes the permanent Discord user ID onto the roster member.</p>
        </header>

        {params?.error ? <div style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: 14, color: '#fca5a5' }}>{String(params.error)}</div> : null}
        {params?.success ? <div style={{ border: '1px solid #14532d', borderRadius: 12, padding: 14, color: '#86efac' }}>{String(params.success)}</div> : null}
        {error ? <div style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: 14, color: '#fca5a5' }}>Could not load claims.</div> : null}

        <section style={{ border: '1px solid #232832', borderRadius: 16, overflow: 'hidden', background: '#11151a' }}>
          <div style={{ padding: 20, borderBottom: '1px solid #232832' }}><strong>Pending · {pending.length}</strong><div style={{ color: '#8893a1', fontSize: 13, marginTop: 4 }}>Oldest claims are shown first.</div></div>
          {pending.length ? pending.map((claim) => {
            const member = claim.guild_members
            return (
              <div key={claim.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(160px, 1fr) minmax(120px, .7fr) minmax(150px, .7fr)', gap: 18, padding: 20, borderBottom: '1px solid #1d222b', alignItems: 'center' }}>
                <div><strong>{member?.ign || 'Unknown character'}</strong><div style={{ color: '#8893a1', fontSize: 13, marginTop: 4 }}>{member?.job_code || 'Job not set'} · {member?.status || 'Unknown status'}</div></div>
                <div><strong>{claim.discord_display_name || claim.discord_username || 'Discord user'}</strong><div style={{ color: '#606b79', fontSize: 11, marginTop: 4 }}>{claim.discord_user_id}</div></div>
                <div style={{ color: '#8893a1', fontSize: 13 }}>{new Date(claim.requested_at).toLocaleString()}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <form action={approveClaim}><input type="hidden" name="claim_id" value={claim.id} /><input type="hidden" name="guild_id" value={guild.id} /><button type="submit" style={{ border: 0, borderRadius: 9, padding: '9px 12px', fontWeight: 800, cursor: 'pointer' }}>Approve</button></form>
                  <form action={rejectClaim} style={{ display: 'flex', gap: 6 }}><input type="hidden" name="claim_id" value={claim.id} /><input type="hidden" name="guild_id" value={guild.id} /><input name="reason" placeholder="Reason (optional)" maxLength={500} style={{ width: 145, border: '1px solid #303742', borderRadius: 9, background: '#0b0d10', color: '#f5f7fa', padding: '8px 9px' }} /><button type="submit" style={{ border: '1px solid #303742', borderRadius: 9, background: '#0b0d10', color: '#f5f7fa', padding: '9px 12px', cursor: 'pointer' }}>Reject</button></form>
                </div>
              </div>
            )
          }) : <div style={{ padding: 24, color: '#8893a1' }}>No pending character claims.</div>}
        </section>

        <section style={{ border: '1px solid #232832', borderRadius: 16, overflow: 'hidden', background: '#11151a' }}>
          <div style={{ padding: 20, borderBottom: '1px solid #232832' }}><strong>Recent decisions</strong></div>
          {recent.length ? recent.map((claim) => <div key={claim.id} style={{ padding: '14px 20px', borderBottom: '1px solid #1d222b', display: 'flex', justifyContent: 'space-between', gap: 16, color: '#bbc3ce' }}><span>{claim.guild_members?.ign || 'Unknown'} · {claim.discord_display_name || claim.discord_username || claim.discord_user_id}</span><span style={{ color: '#8893a1', fontSize: 13 }}>{claim.status}</span></div>) : <div style={{ padding: 24, color: '#8893a1' }}>No decisions yet.</div>}
        </section>
      </div>
    </main>
  )
}
