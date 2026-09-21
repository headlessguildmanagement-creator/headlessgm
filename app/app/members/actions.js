'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { normalizeIgn } from '../../../lib/ign-normalize.mjs'

function safe(value) { return encodeURIComponent(String(value || '').slice(0, 220)) }
function norm(value) { return normalizeIgn(value) }

async function getAuthenticatedGuild(supabase, guildId) {
  const { data: authData, error: authError } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub
  if (authError || !userId) redirect('/login')
  const { data: guild } = await supabase.from('guilds').select('id, plan_code, game_preset_id, owner_user_id').eq('id', guildId).single()
  if (!guild) redirect('/app')
  if (guild.owner_user_id !== userId) {
    const { data: membership } = await supabase.from('guild_users').select('role').eq('guild_id', guildId).eq('user_id', userId).in('role', ['owner','officer']).maybeSingle()
    if (!membership) redirect('/app')
  }
  return guild
}

async function getActiveLimit(supabase, planCode) {
  const { data: plan } = await supabase.from('plans').select('active_member_limit').eq('code', planCode).single()
  return plan?.active_member_limit ?? 80
}

async function activeMemberCount(supabase, guildId) {
  const { count } = await supabase.from('guild_members').select('id', { count: 'exact', head: true }).eq('guild_id', guildId).eq('status', 'active')
  return count ?? 0
}

function parseCsvLine(line) {
  const out = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++ } else quoted = !quoted
    } else if (ch === ',' && !quoted) { out.push(value.trim()); value = '' }
    else value += ch
  }
  out.push(value.trim())
  return out
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map(norm)
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function xmlValue(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))
    if (match) return match[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim()
  }
  return ''
}

function parseXml(text) {
  const members = [...text.matchAll(/<member\b[^>]*>([\s\S]*?)<\/member>/gi)]
  return members.map((match) => ({
    ign: xmlValue(match[1], ['ign','name']), class: xmlValue(match[1], ['class','job','jobclass']),
    combatrole: xmlValue(match[1], ['combatrole','combat_role','role']), guildrank: xmlValue(match[1], ['guildrank','guild_rank','rank']),
    feathergroup: xmlValue(match[1], ['feathergroup','feather_group','group']), puppetorder: xmlValue(match[1], ['puppetorder','puppet_order']),
  }))
}

function pick(row, names) {
  for (const name of names) {
    const key = norm(name)
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim()
  }
  return ''
}

function featherGroup(value) {
  const v = String(value || '').trim().toUpperCase()
  if (!v) return null
  if (/^[1-4]$/.test(v)) return Number(v)
  if (/^[A-D]$/.test(v)) return v.charCodeAt(0) - 64
  return NaN
}

function puppetOrder(value) {
  if (String(value || '').trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : NaN
}

export async function importMembers(formData) {
  const supabase = await createClient()
  const guildId = String(formData.get('guild_id') || '')
  const file = formData.get('roster_file')
  if (!guildId || !(file instanceof File) || !file.size) redirect('/app/members?error=Choose%20a%20CSV%20or%20XML%20roster%20file.')
  if (file.size > 2 * 1024 * 1024) redirect('/app/members?error=Roster%20file%20must%20be%202%20MB%20or%20smaller.')

  const guild = await getAuthenticatedGuild(supabase, guildId)
  if (guild.plan_code === 'free') redirect('/app/members?error=Roster%20file%20import%20requires%20the%20GUILD%20plan.%20FREE%20uses%20manual%20roster%20entry.')
  const text = await file.text()
  const isXml = file.name.toLowerCase().endsWith('.xml') || file.type.includes('xml')
  const rawRows = isXml ? parseXml(text) : parseCsv(text)
  if (!rawRows.length) redirect('/app/members?error=No%20member%20rows%20were%20found%20in%20that%20file.')
  if (rawRows.length > 200) redirect('/app/members?error=Import%20a%20maximum%20of%20200%20members%20at%20a%20time.')

  const [{ data: jobs }, { data: rules }, { data: maxPuppet }] = await Promise.all([
    supabase.from('game_jobs').select('code,label').eq('game_preset_id', guild.game_preset_id).eq('is_active', true),
    supabase.from('guild_auction_rules').select('feather_mode,puppet_mode').eq('guild_id', guild.id).maybeSingle(),
    supabase.from('guild_members').select('puppet_order').eq('guild_id', guild.id).not('puppet_order', 'is', null).order('puppet_order', { ascending: false }).limit(1),
  ])

  const jobMap = new Map()
  for (const job of jobs || []) { jobMap.set(norm(job.code), job.code); jobMap.set(norm(job.label), job.code) }
  const seenIgns = new Set()
  const seenOrders = new Set()
  const rows = []
  const errors = []
  let nextPuppetOrder = (maxPuppet?.[0]?.puppet_order || 0) + 1

  rawRows.forEach((row, index) => {
    const line = index + 2
    const ign = pick(row, ['IGN','name'])
    const jobRaw = pick(row, ['Class','job','jobclass'])
    const roleRaw = pick(row, ['CombatRole','combat_role']).toLowerCase()
    const roleMap = { dps: 'DPS', support: 'Support', utility: 'Utility', tank: 'Tank' }
    const combatRole = roleRaw ? roleMap[roleRaw] : null
    const guildRole = pick(row, ['GuildRank','guild_rank','rank']) || 'Member'
    const group = featherGroup(pick(row, ['FeatherGroup','feather_group','group']))
    let order = puppetOrder(pick(row, ['PuppetOrder','puppet_order']))
    const jobCode = jobMap.get(norm(jobRaw)) || null

    if (!ign) errors.push(`Row ${line}: IGN is required.`)
    else if (seenIgns.has(norm(ign))) errors.push(`Row ${line}: duplicate IGN ${ign}.`)
    if (!jobCode) errors.push(`Row ${line}: class ${jobRaw || 'blank'} is not recognized.`)
    if (roleRaw && !combatRole) errors.push(`Row ${line}: CombatRole must be DPS, Support, Utility or Tank.`)
    if (Number.isNaN(group)) errors.push(`Row ${line}: FeatherGroup must be 1-4 or A-D.`)
    if (rules?.feather_mode === 'four_group' && group == null) errors.push(`Row ${line}: FeatherGroup is required for 4 Group Division.`)
    if (Number.isNaN(order)) errors.push(`Row ${line}: PuppetOrder must be a positive whole number.`)
    if (rules?.puppet_mode === 'round_robin' && order == null) { order = nextPuppetOrder; nextPuppetOrder += 1 }
    if (order != null && seenOrders.has(order)) errors.push(`Row ${line}: duplicate PuppetOrder ${order}.`)

    if (ign) seenIgns.add(norm(ign))
    if (order != null && !Number.isNaN(order)) seenOrders.add(order)
    rows.push({ ign, job_code: jobCode, combat_role: combatRole, guild_role: guildRole, feather_group: Number.isNaN(group) ? null : group, puppet_order: Number.isNaN(order) ? null : order, status: 'active' })
  })

  if (errors.length) redirect(`/app/members?error=${safe(errors.slice(0, 5).join(' '))}`)
  const { data: inserted, error } = await supabase.rpc('import_guild_roster', { p_guild_id: guild.id, p_rows: rows })
  if (error) redirect(`/app/members?error=${safe(error.message || 'Roster import failed.')}`)

  revalidatePath('/app/members')
  revalidatePath('/app')
  redirect(`/app/members?success=${safe(`${inserted ?? rows.length} members imported successfully.`)}`)
}

export async function addMember(formData) {
  const supabase = await createClient()
  const guildId = String(formData.get('guild_id') || '')
  const ign = String(formData.get('ign') || '').trim()
  const jobCode = String(formData.get('job_code') || '').trim() || null
  const guildRole = String(formData.get('guild_role') || '').trim() || null
  const combatRole = String(formData.get('combat_role') || '').trim() || null
  const requestedStatus = String(formData.get('status') || 'active')
  const status = requestedStatus === 'pending' ? 'pending' : 'active'
  if (!guildId || ign.length < 1 || ign.length > 80) redirect('/app/members?error=Enter%20a%20valid%20IGN.')

  const guild = await getAuthenticatedGuild(supabase, guildId)
  if (status === 'active') {
    const [limit, currentCount] = await Promise.all([getActiveLimit(supabase, guild.plan_code), activeMemberCount(supabase, guild.id)])
    if (currentCount >= limit) redirect(`/app/members?error=Active%20member%20limit%20reached%20(${limit}).`)
  }

  const { data: rules } = await supabase.from('guild_auction_rules').select('puppet_mode').eq('guild_id', guild.id).maybeSingle()
  let nextOrder = null
  if (status === 'active' && rules?.puppet_mode === 'round_robin') {
    const { data: last } = await supabase.from('guild_members').select('puppet_order').eq('guild_id', guild.id).not('puppet_order', 'is', null).order('puppet_order', { ascending: false }).limit(1)
    nextOrder = (last?.[0]?.puppet_order || 0) + 1
  }

  const { error } = await supabase.from('guild_members').insert({ guild_id: guild.id, ign, job_code: jobCode, combat_role: combatRole, guild_role: guildRole, puppet_order: nextOrder, is_officer: /officer|commander|vice|guild leader|leader/i.test(guildRole || ''), status })
  if (error) redirect(`/app/members?error=${safe(error.message || 'Could not add that member.')}`)
  revalidatePath('/app/members')
  redirect('/app/members?success=Member%20added.')
}

export async function updateMemberStatus(formData) {
  const supabase = await createClient()
  const guildId = String(formData.get('guild_id') || '')
  const memberId = String(formData.get('member_id') || '')
  const requestedStatus = String(formData.get('status') || '')
  const allowedStatuses = new Set(['active', 'pending', 'inactive', 'left'])
  if (!guildId || !memberId || !allowedStatuses.has(requestedStatus)) redirect('/app/members?error=Invalid%20member%20update.')

  const guild = await getAuthenticatedGuild(supabase, guildId)
  if (requestedStatus === 'active') {
    const { data: member } = await supabase.from('guild_members').select('status,puppet_order').eq('id', memberId).eq('guild_id', guild.id).single()
    if (member?.status !== 'active') {
      const [limit, currentCount] = await Promise.all([getActiveLimit(supabase, guild.plan_code), activeMemberCount(supabase, guild.id)])
      if (currentCount >= limit) redirect(`/app/members?error=Active%20member%20limit%20reached%20(${limit}).`)
    }
  }

  const { error } = await supabase.from('guild_members').update({ status: requestedStatus, updated_at: new Date().toISOString() }).eq('id', memberId).eq('guild_id', guild.id)
  if (error) redirect('/app/members?error=Could%20not%20update%20that%20member.')
  revalidatePath('/app/members')
  redirect('/app/members')
}
