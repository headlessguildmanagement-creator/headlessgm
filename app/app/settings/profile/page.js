import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { resolveGuild } from '../../../../lib/guild-context'
import AppShell from '../../../../components/app-shell'
import { saveGuildProfile } from './actions'

export default async function GuildProfileSettingsPage({ searchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const guild = await resolveGuild(supabase, params?.guild, 'id,name,slug,timezone,plan_code,owner_user_id,logo_url,attendance_mode,loa_deadline_local_time')
  if (!guild) redirect('/app/onboarding')
  if (guild.owner_user_id !== userId) redirect('/app/settings')

  const timeValue = String(guild.loa_deadline_local_time || '19:30:00').slice(0, 5)

  return (
    <AppShell guildName={guild.name} guildSlug={guild.slug} title="Guild Profile" activeHref="/app/settings">
      {params?.error ? <div className="notice error">{String(params.error)}</div> : null}
      {params?.success ? <div className="notice success">{String(params.success)}</div> : null}

      <form action={saveGuildProfile} style={{ display: 'grid', gap: 18 }}>
        <input type="hidden" name="guild_id" value={guild.id} />

        <section className="panel panel-pad">
          <div className="section-head"><div><h2>Guild identity</h2><p>The workspace slug stays stable for links and tenant routing even if the display name changes.</p></div><span className="pill">/{guild.slug}</span></div>
          <div className="form-grid">
            <label className="field"><span>Guild name</span><input type="text" name="name" required minLength={2} maxLength={80} defaultValue={guild.name} /></label>
            <label className="field"><span>Timezone</span><select name="timezone" defaultValue={guild.timezone}><option value="Asia/Manila">Asia/Manila</option><option value="Asia/Singapore">Asia/Singapore</option><option value="Asia/Tokyo">Asia/Tokyo</option><option value="America/New_York">America/New_York</option><option value="America/Los_Angeles">America/Los_Angeles</option><option value="Europe/London">Europe/London</option><option value="UTC">UTC</option></select></label>
            <label className="field full"><span>Replace guild logo · optional · max 2 MB</span><input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
          </div>
          {guild.logo_url ? <div style={{ marginTop: 14 }}><img src={guild.logo_url} alt={`${guild.name} logo`} style={{ maxWidth: 96, maxHeight: 96, borderRadius: 12, border: '1px solid var(--line)' }} /></div> : null}
        </section>

        {guild.plan_code === 'free' ? <section className="panel panel-pad">
          <p className="eyebrow">FREE · MANUAL ATTENDANCE</p>
          <h2 style={{ marginTop: 6 }}>Officer-managed attendance</h2>
          <p className="muted">Members do not file LOA on FREE. Officers mark attendance manually inside each event. Member LOA and attendance automation unlock on GUILD.</p>
          <input type="hidden" name="attendance_mode" value="assume_attending" />
          <input type="hidden" name="loa_deadline_local_time" value={timeValue} />
        </section> : <section className="panel panel-pad">
          <div className="section-head"><div><h2>Attendance & LOA defaults</h2><p>These defaults apply to future operations. Historical event snapshots remain unchanged.</p></div></div>
          <div className="form-grid">
            <label className="field"><span>Attendance mode</span><select name="attendance_mode" defaultValue={guild.attendance_mode || 'assume_attending'}><option value="assume_attending">Assume attending unless LOA</option><option value="rsvp_required">RSVP required</option>{guild.plan_code === 'commander' || guild.plan_code === 'beta' ? <option value="custom">Custom · COMMANDER</option> : null}</select></label>
            <label className="field"><span>LOA deadline on event day</span><input type="time" name="loa_deadline_local_time" defaultValue={timeValue} /></label>
          </div>
        </section>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="button">Save guild profile</button></div>
      </form>
    </AppShell>
  )
}
