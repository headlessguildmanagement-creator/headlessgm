import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { submitCharacterClaim } from './actions'

export default async function LinkCharacterPage({ searchParams }) {
  const params = await searchParams
  const guildId = String(params?.guild || '')
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user
  if (userError || !user) redirect('/login')

  const discordIdentity = (user.identities || []).find((identity) => identity.provider === 'discord')
  if (!discordIdentity?.provider_id && !discordIdentity?.identity_data?.provider_id) {
    return (
      <main style={{ minHeight: '100vh', padding: '48px 24px' }}>
        <div style={{ width: 'min(700px, 100%)', margin: '0 auto' }}>
          <Link href="/app" style={{ color: '#8893a1', textDecoration: 'none' }}>← Dashboard</Link>
          <h1 style={{ fontSize: 48, marginTop: 24 }}>Link My Character</h1>
          <p className="lede">Your HeadlessGM account is not linked to a Discord identity yet. Sign in with Discord first, then return here.</p>
        </div>
      </main>
    )
  }

  const { data: guild } = await supabase.from('guilds').select('id, name').eq('id', guildId).maybeSingle()
  if (!guild) redirect('/app')

  const { data: members, error: membersError } = await supabase
    .from('guild_members')
    .select('id, ign, job_code, status')
    .eq('guild_id', guild.id)
    .in('status', ['active', 'pending'])
    .is('discord_user_id', null)
    .order('ign', { ascending: true })

  const { data: jobs } = await supabase.from('game_jobs').select('code, label').eq('game_preset_id', 'rooc').eq('is_active', true)
  const jobLabels = new Map((jobs || []).map((job) => [job.code, job.label]))

  return (
    <main style={{ minHeight: '100vh', padding: '48px 24px 72px' }}>
      <div style={{ width: 'min(760px, 100%)', margin: '0 auto', display: 'grid', gap: 24 }}>
        <header>
          <Link href="/app" style={{ color: '#8893a1', textDecoration: 'none' }}>← Dashboard</Link>
          <p className="eyebrow" style={{ marginTop: 20 }}>{guild.name}</p>
          <h1 style={{ fontSize: 52, lineHeight: 1, letterSpacing: '-0.04em' }}>Link My Character</h1>
          <p className="lede" style={{ fontSize: 18, marginTop: 14 }}>Choose the existing HeadlessGM roster record that belongs to your Discord identity. Username or nickname is never used as the link key.</p>
        </header>

        {params?.error ? <div style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: 14, color: '#fca5a5' }}>{String(params.error)}</div> : null}
        {params?.success ? <div style={{ border: '1px solid #14532d', borderRadius: 12, padding: 14, color: '#86efac' }}>{String(params.success)}</div> : null}

        {membersError ? <div style={{ border: '1px solid #7f1d1d', borderRadius: 12, padding: 14, color: '#fca5a5' }}>Could not load the available roster.</div> : members?.length ? (
          <section style={{ display: 'grid', gap: 12 }}>
            {members.map((member) => (
              <form key={member.id} action={submitCharacterClaim} style={{ border: '1px solid #232832', borderRadius: 14, background: '#11151a', padding: 18, display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}>
                <input type="hidden" name="guild_id" value={guild.id} />
                <input type="hidden" name="guild_member_id" value={member.id} />
                <input type="hidden" name="discord_username" value={user.user_metadata?.user_name || user.user_metadata?.preferred_username || ''} />
                <input type="hidden" name="discord_display_name" value={user.user_metadata?.full_name || user.user_metadata?.name || ''} />
                <div><strong style={{ fontSize: 18 }}>{member.ign}</strong><div style={{ color: '#8893a1', fontSize: 13, marginTop: 5 }}>{jobLabels.get(member.job_code) || member.job_code || 'Job not set'} · {member.status}</div></div>
                <button type="submit" style={{ border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 800, cursor: 'pointer' }}>Claim</button>
              </form>
            ))}
          </section>
        ) : <section style={{ border: '1px solid #232832', borderRadius: 14, background: '#11151a', padding: 24 }}><strong>No unlinked characters are available.</strong><p style={{ color: '#8893a1', marginBottom: 0 }}>An officer may need to add your character to the HeadlessGM roster first, or another claim may already be pending.</p></section>}
      </div>
    </main>
  )
}
