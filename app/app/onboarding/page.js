import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import ThemeToggle from '../../../components/theme-toggle'
import { createGuild } from './actions'

export default async function OnboardingPage({ searchParams }) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  if (authError || !authData?.claims?.sub) redirect('/login')

  const { data: guilds } = await supabase.from('guilds').select('id').limit(1)
  if (guilds?.length) redirect('/app')

  const params = await searchParams
  const error = params?.error ? String(params.error) : ''

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 64px' }}>
      <div style={{ width: 'min(980px, 100%)', margin: '0 auto', display: 'grid', gap: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'start', flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow">HEADLESSGM SETUP</p>
            <h1 style={{ fontSize: 38, margin: '4px 0 8px' }}>Set up your guild.</h1>
            <p className="lede" style={{ fontSize: 16, margin: 0 }}>Start on FREE with the simplest HeadlessGM workflow. GUILD and COMMANDER unlock recruitment, Discord and deeper operating rules.</p>
          </div>
          <ThemeToggle />
        </header>

        {error ? <div className="notice error">{error}</div> : null}

        <form action={createGuild} style={{ display: 'grid', gap: 18 }}>
          <section className="panel panel-pad">
            <div className="section-head"><div><h2>1. Guild profile</h2><p>Name, logo and timezone define the workspace. Logo upload is optional.</p></div><span className="pill">ROOC PRESET</span></div>
            <div className="form-grid">
              <label className="field"><span>Guild name</span><input type="text" name="name" required minLength={2} maxLength={80} placeholder="e.g. Havoc" autoComplete="organization" /></label>
              <label className="field"><span>Timezone</span><select name="timezone" defaultValue="Asia/Manila"><option value="Asia/Manila">Asia/Manila</option><option value="Asia/Singapore">Asia/Singapore</option><option value="Asia/Tokyo">Asia/Tokyo</option><option value="America/New_York">America/New_York</option><option value="America/Los_Angeles">America/Los_Angeles</option><option value="Europe/London">Europe/London</option><option value="UTC">UTC</option></select></label>
              <label className="field full"><span>Guild logo · PNG/JPG/WebP/GIF · max 2 MB</span><input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
            </div>
          </section>

          <section className="panel panel-pad">
            <div className="section-head"><div><h2>2. Auction presets</h2><p>These choices determine roster fields, eligibility behavior and the format HeadlessGM expects during import.</p></div></div>
            <div className="form-grid">
              <label className="field"><span>Feather auction</span><select name="feather_mode" defaultValue="ffa"><option value="ffa">Free For All</option><option value="random">Random</option></select></label>
              <label className="field"><span>Puppet auction</span><select name="puppet_mode" defaultValue="ffa"><option value="ffa">Free For All</option><option value="random">Random</option></select></label>
            </div>
          </section>

          <section className="panel panel-pad"><p className="eyebrow">FREE</p><h2 style={{marginTop:6}}>Simple auction setup</h2><p className="muted">FREE includes FFA and Random. Per-person reward caps, 4 Group Feather and Puppet Round Robin unlock on GUILD. Custom rules unlock on COMMANDER.</p></section>

          <section className="panel panel-pad">
            <div className="section-head"><div><h2>3. Attendance & LOA</h2><p>Havoc defaults to everyone attending unless they file LOA.</p></div></div>
            <div className="form-grid">
              <label className="field"><span>Attendance rule</span><select name="attendance_mode" defaultValue="assume_attending"><option value="assume_attending">Assume attending unless LOA</option><option value="rsvp_required">RSVP required</option></select></label>
              <label className="field"><span>LOA deadline on event day</span><input type="time" name="loa_deadline_local_time" defaultValue="19:30" /></label>
            </div>
          </section>

          <section className="panel panel-pad">
            <div className="section-head"><div><h2>4. Roster comes next</h2><p>After this step you can upload CSV/XML or add members manually. The importer supports IGN, Class, CombatRole, GuildRank, FeatherGroup and PuppetOrder.</p></div></div>
            <div className="notice">You can skip the roster, Discord and recruitment steps and return to them later from Settings.</div>
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="button">Create workspace & continue</button></div>
        </form>
      </div>
    </main>
  )
}
