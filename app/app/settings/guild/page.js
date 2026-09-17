import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import AppShell from '../../../../components/app-shell'
import { saveGuildProfile } from './actions'

export default async function GuildSettingsPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  const { data: guild } = await supabase.from('guilds').select('id,name,slug,timezone,logo_url,attendance_mode,loa_deadline_local_time,owner_user_id').limit(1).maybeSingle()
  if (!guild) redirect('/app/onboarding')
  if (guild.owner_user_id !== userId) redirect('/app/settings')
  const params = await searchParams
  const deadline = String(guild.loa_deadline_local_time || '19:30:00').slice(0,5)

  return (
    <AppShell guildName={guild.name} eyebrow="SETTINGS" title="Guild Profile" activeHref="/app/settings">
      {params?.error ? <div className="notice error">{String(params.error)}</div> : null}
      {params?.success ? <div className="notice success">{String(params.success)}</div> : null}

      <form action={saveGuildProfile} style={{ display: 'grid', gap: 18 }}>
        <input type="hidden" name="guild_id" value={guild.id} />
        <section className="panel panel-pad">
          <div className="section-head"><div><h2>Workspace identity</h2><p>Changing the slug changes the public workspace URL, including the recruitment link.</p></div></div>
          <div className="form-grid">
            <label className="field"><span>Guild name</span><input type="text" name="name" required minLength={2} maxLength={80} defaultValue={guild.name} /></label>
            <label className="field"><span>Workspace slug</span><input type="text" name="slug" required minLength={3} maxLength={64} defaultValue={guild.slug} /></label>
            <label className="field"><span>Timezone</span><select name="timezone" defaultValue={guild.timezone || 'Asia/Manila'}><option value="Asia/Manila">Asia/Manila</option><option value="Asia/Singapore">Asia/Singapore</option><option value="Asia/Tokyo">Asia/Tokyo</option><option value="America/New_York">America/New_York</option><option value="America/Los_Angeles">America/Los_Angeles</option><option value="Europe/London">Europe/London</option><option value="UTC">UTC</option></select></label>
            <label className="field"><span>Replace guild logo · max 2 MB</span><input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
          </div>
          {guild.logo_url ? <div style={{ marginTop: 14 }}><img src={guild.logo_url} alt={`${guild.name} logo`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} /></div> : null}
        </section>

        <section className="panel panel-pad">
          <div className="section-head"><div><h2>Attendance & LOA</h2><p>These are the guild defaults used when creating future events.</p></div></div>
          <div className="form-grid">
            <label className="field"><span>Attendance mode</span><select name="attendance_mode" defaultValue={guild.attendance_mode || 'assume_attending'}><option value="assume_attending">Assume attending unless LOA</option><option value="rsvp_required">RSVP required</option></select></label>
            <label className="field"><span>LOA deadline on event day</span><input type="time" name="loa_deadline_local_time" defaultValue={deadline} required /></label>
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="button">Save guild settings</button></div>
      </form>
    </AppShell>
  )
}
