export const PLAN_MATRIX = {
  free: {
    code: 'free',
    label: 'FREE',
    publicRecruitment: false,
    discord: false,
    rosterImport: false,
    memberLoa: false,
    history: false,
    previousLineup: false,
    advancedAuction: false,
    rewardCaps: false,
    customAuction: false,
    brandStudio: false,
    customOverview: false,
  },
  guild: {
    code: 'guild',
    label: 'GUILD',
    publicRecruitment: true,
    discord: true,
    rosterImport: true,
    memberLoa: true,
    history: true,
    previousLineup: true,
    advancedAuction: true,
    rewardCaps: true,
    customAuction: false,
    brandStudio: false,
    customOverview: false,
  },
  commander: {
    code: 'commander',
    label: 'COMMANDER',
    publicRecruitment: true,
    discord: true,
    rosterImport: true,
    memberLoa: true,
    history: true,
    previousLineup: true,
    advancedAuction: true,
    rewardCaps: true,
    customAuction: true,
    brandStudio: true,
    customOverview: true,
  },
}

export function normalizePlan(code) {
  const value = String(code || 'free').toLowerCase()
  return value === 'beta' ? 'commander' : (PLAN_MATRIX[value] ? value : 'free')
}

export function planCapabilities(code) {
  return PLAN_MATRIX[normalizePlan(code)]
}

export function hasPlanCapability(code, capability) {
  return Boolean(planCapabilities(code)?.[capability])
}

export function allowedFeatherModes(code) {
  const plan = normalizePlan(code)
  if (plan === 'free') return ['ffa', 'random']
  if (plan === 'guild') return ['ffa', 'random', 'four_group']
  return ['ffa', 'random', 'four_group', 'custom']
}

export function allowedPuppetModes(code) {
  const plan = normalizePlan(code)
  if (plan === 'free') return ['ffa', 'random']
  if (plan === 'guild') return ['ffa', 'random', 'round_robin']
  return ['ffa', 'random', 'round_robin', 'custom']
}

export const OVERVIEW_MODULES = [
  { id: 'stats', label: 'Key metrics' },
  { id: 'current_event', label: 'Current event command' },
  { id: 'alerts', label: 'Roster & lineup alerts' },
  { id: 'events', label: 'Upcoming events' },
  { id: 'feather', label: 'Feather groups' },
  { id: 'puppet', label: 'Next Puppet bidders' },
  { id: 'operations', label: 'Operations shortcuts' },
]

export const DEFAULT_OVERVIEW_MODULES = OVERVIEW_MODULES.map((item) => item.id)
