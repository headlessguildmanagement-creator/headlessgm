'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../lib/supabase/server'

function safe(value) {
  return encodeURIComponent(String(value || '').slice(0, 220))
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1 }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field.trim()); field = '' }
    else if (ch === '\n') { row.push(field.trim()); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field.length || row.length) { row.push(field.trim()); rows.push(row) }
  return rows.filter((r) => r.some((v) => v !== ''))
}

function decodeXml(value) {
  return String(value || '')
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"').replaceAll('&apos;', "'").trim()
}

function xmlTag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))
    if (match) return decodeXml(match[1].replace(/<[^>]+>/g, ''))
  }
  return ''
}

function parseXml(text) {
  const blocks = [...text.matchAll(/<member\b[^>]*>([\s\S]*?)<\/member>/gi)].map((m) => m[1])
  return blocks.map((block) => ({
    IGN: xmlTag(block, ['IGN', 'ign']),
    Class: xmlTag(block, ['Class', 'class', 'Job', 'job']),
    CombatRole: xmlTag(block, ['CombatRole', 'combat_role', 'Role']),
    GuildRank: xmlTag(block, ['GuildRank', 'guild_rank', 'GuildRole', 'guild_role', 'Rank']),
    FeatherGroup: xmlTag(block, ['FeatherGroup', 'feather_group', 'Group']),
    PuppetOrder: xmlTag(block, ['PuppetOrder', 'puppet_order']),
    Status: xmlTag(block, ['Status', 'status']),
  }))
}

function normalizeHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function csvObjects(matrix) {
  if (matrix.length < 2) return []
  const headers = matrix[0].map(normalizeHeader)
  const aliases = {
    ign: 'IGN', character: 'IGN', charactername: 'IGN',
    class: 'Class', job: 'Class', jobclass: 'Class',
    combatrole: 'CombatRole', role: 'CombatRole',
    guildrank: 'GuildRank', guildrole: 'GuildRank', rank: 'GuildRank',
    feathergroup: 'FeatherGroup', group: 'FeatherGroup', grouping: 'FeatherGroup',
    puppetorder: 'PuppetOrder', puppetqueue: 'PuppetOrder',
    status: 'Status',
  }
  return matrix.slice(1).map((row) => {
    const obj = {}
    headers.forEach((header, index) => { if (aliases[header]) obj[aliases[header]] = row[index] || '' })
    return obj
  })
}

function numberOrNull(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isInteger(n) ? n : null
}

function featherGroup(value) {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return null
  if (/^[1-4]$/.test(raw)) return Number(raw)
  if (/^[A-D]$/.test(raw)) return raw.charCodeAt(0) - 64
  return null
}

export async function importRoster(formData) {
  const guildId = String(formData.get('guild_id') || '')
  const file = formData.get('roster_file')
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')

  if (!(file instanceof File) || !file.size) redirect('/app/members/import?error=Choose%20a%20CSV%20or%20XML%20file.')
  if (file.size > 2 * 1024 * 1024) redirect('/app/members/import?error=Roster%20file%20must%20be%202%20MB%20or%20smaller.')

  const { data: guild } = await supabase.from('guilds').select('id,owner_user_id,game_preset_id,plan_code').eq('id', guildId).maybeSingle()
  if (!guild) redirect('/app/members/import?error=Guild%20not%20found.')
  if (guild.plan_code === 'free') redirect('/app/members?error=Roster%20file%20import%20requires%20the%20GUILD%20plan.%20FREE%20uses%20manual%20entry.')
  if (guild.owner_user_id !== userId) {
    const { data: access } = await supabase.from('guild_users').select('role').eq('guild_id', guildId).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()
    if (!access) redirect('/app?error=Officer%20access%20required.')
  }

  const [{ data: jobs }, { data: rules }, { data: maxRows }] = await Promise.all([
    supabase.from('game_jobs').select('code,label').eq('game_preset_id', guild.game_preset_id).eq('is_active', true),
    supabase.from('guild_auction_rules').select('feather_mode,puppet_mode').eq('guild_id', guildId).maybeSingle(),
    supabase.from('guild_members').select('puppet_order').eq('guild_id', guildId).not('puppet_order', 'is', null).order('puppet_order', { ascending: false }).limit(1),
  ])

  const jobLookup = new Map()
  for (const job of jobs || []) {
    jobLookup.set(job.code.toLowerCase(), job.code)
    jobLookup.set(job.label.toLowerCase(), job.code)
  }

  const text = await file.text()
  const xml = file.name.toLowerCase().endsWith('.xml') || file.type.includes('xml')
  let rawRows
  try { rawRows = xml ? parseXml(text) : csvObjects(parseCsv(text)) }
  catch { redirect('/app/members/import?error=Could%20not%20parse%20that%20file.') }
  if (!rawRows?.length) redirect('/app/members/import?error=No%20member%20rows%20were%20found.')
  if (rawRows.length > 200) redirect('/app/members/import?error=Import%20is%20limited%20to%20200%20rows%20at%20a%20time.')

  let nextPuppet = (maxRows?.[0]?.puppet_order || 0) + 1
  const normalized = []
  const errors = []

  rawRows.forEach((row, index) => {
    const line = index + (xml ? 1 : 2)
    const ign = String(row.IGN || '').trim()
    const classRaw = String(row.Class || '').trim()
    const jobCode = classRaw ? jobLookup.get(classRaw.toLowerCase()) : null
    const roleRaw = String(row.CombatRole || '').trim().toLowerCase()
    const roleMap = { dps: 'DPS', support: 'Support', utility: 'Utility', tank: 'Tank' }
    const combatRole = roleRaw ? roleMap[roleRaw] : null
    const group = featherGroup(row.FeatherGroup)
    let puppetOrder = numberOrNull(row.PuppetOrder)
    const statusRaw = String(row.Status || 'active').trim().toLowerCase()
    const status = statusRaw === 'pending' ? 'pending' : 'active'

    if (!ign) errors.push(`Row ${line}: IGN is required.`)
    if (classRaw && !jobCode) errors.push(`Row ${line}: class “${classRaw}” is not recognized.`)
    if (roleRaw && !combatRole) errors.push(`Row ${line}: CombatRole must be DPS, Support, Utility or Tank.`)
    if (rules?.feather_mode === 'four_group' && !group) errors.push(`Row ${line}: FeatherGroup 1-4 (or A-D) is required for 4 Group Division.`)
    if (String(row.FeatherGroup || '').trim() && !group) errors.push(`Row ${line}: FeatherGroup must be 1-4 or A-D.`)
    if (String(row.PuppetOrder || '').trim() && (!puppetOrder || puppetOrder < 1)) errors.push(`Row ${line}: PuppetOrder must be a positive whole number.`)
    if (rules?.puppet_mode === 'round_robin' && !puppetOrder) { puppetOrder = nextPuppet; nextPuppet += 1 }

    normalized.push({
      ign,
      job_code: jobCode,
      combat_role: combatRole,
      guild_role: String(row.GuildRank || '').trim() || null,
      feather_group: group,
      puppet_order: puppetOrder,
      status,
    })
  })

  const ignKeys = normalized.map((row) => row.ign.toLowerCase()).filter(Boolean)
  if (new Set(ignKeys).size !== ignKeys.length) errors.push('The file contains duplicate IGN values.')
  const puppetOrders = normalized.map((row) => row.puppet_order).filter(Boolean)
  if (new Set(puppetOrders).size !== puppetOrders.length) errors.push('The file contains duplicate PuppetOrder values.')

  if (errors.length) redirect(`/app/members/import?error=${safe(errors.slice(0, 4).join(' '))}`)

  const { data: inserted, error } = await supabase.rpc('import_guild_roster', { p_guild_id: guildId, p_rows: normalized })
  if (error) redirect(`/app/members/import?error=${safe(error.message || 'Roster import failed.')}`)

  revalidatePath('/app/members')
  redirect(`/app/members?success=${safe(`${inserted || normalized.length} members imported.`)}`)
}
