function parseDate(date) {
  const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new Error('Expected YYYY-MM-DD date')
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function dateKey(date) {
  return date.toISOString().slice(0, 10)
}

function wrapGroup(value) {
  return ((value - 1) % 4 + 4) % 4 + 1
}

function scheduledOffset(anchorDate, targetDate, weekdays) {
  const anchor = parseDate(anchorDate)
  const target = parseDate(targetDate)
  if (anchor.getTime() === target.getTime()) return 0

  const direction = target > anchor ? 1 : -1
  let cursor = new Date(anchor)
  let offset = 0

  while (cursor.getTime() !== target.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + direction)
    if (direction > 0) {
      if (weekdays.has(cursor.getUTCDay())) offset += 1
    } else if (cursor.getTime() !== anchor.getTime() && weekdays.has(cursor.getUTCDay())) {
      offset -= 1
    }
  }
  return offset
}

/**
 * Havoc ROOC Feather rotation anchors proven by the production regression suite.
 * GL runs Tue/Thu with 4 → 3 → 2 → 1.
 * EO runs Sun with 2 → 3 → 4 → 1.
 */
export function havocFeatherGroup(eventType, localDate) {
  if (eventType === 'guild_league') {
    const offset = scheduledOffset('2026-08-27', localDate, new Set([2, 4]))
    return wrapGroup(3 - offset)
  }
  if (eventType === 'emperium_overrun') {
    const offset = scheduledOffset('2026-08-30', localDate, new Set([0]))
    return wrapGroup(2 + offset)
  }
  return null
}

export function isHavocScheduledEventDay(eventType, localDate) {
  const day = parseDate(localDate).getUTCDay()
  if (eventType === 'guild_league') return day === 2 || day === 4
  if (eventType === 'emperium_overrun') return day === 0
  return false
}

export function localDateFromInstant(instant, timeZone = 'Asia/Manila') {
  const date = instant instanceof Date ? instant : new Date(instant)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid instant')
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

export function havocFeatherGroupForInstant(eventType, instant, timeZone = 'Asia/Manila') {
  return havocFeatherGroup(eventType, localDateFromInstant(instant, timeZone))
}

export { wrapGroup, dateKey }
