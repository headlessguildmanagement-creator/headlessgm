const FONT_STACKS = {
  modern: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  compact: '"Arial Narrow", "Roboto Condensed", Impact, ui-sans-serif, sans-serif',
  editorial: 'Georgia, "Times New Roman", serif',
  classic: 'Garamond, Georgia, "Times New Roman", serif',
}

function safeHex(value, fallback) {
  const raw = String(value || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : fallback
}

export function commanderBrandStyle(planCode, settings = {}) {
  if (!['commander','beta'].includes(String(planCode || '').toLowerCase())) return {}
  const brand = settings?.brand || {}
  const fontStyle = FONT_STACKS[brand.fontStyle] ? brand.fontStyle : 'modern'
  const radius = ['6','12','18'].includes(String(brand.radius)) ? String(brand.radius) : '12'
  return {
    '--accent': safeHex(brand.primary, '#635bff'),
    '--accent2': safeHex(brand.secondary, '#22d3ee'),
    '--brand-secondary': safeHex(brand.secondary, '#22d3ee'),
    '--brand-radius': `${radius}px`,
    '--brand-display-font': FONT_STACKS[fontStyle],
    '--brand-body-font': fontStyle === 'editorial' || fontStyle === 'classic'
      ? 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      : FONT_STACKS[fontStyle],
  }
}
