export const LAUNCH_PROMO_CODE = 'launch30'
export const LAUNCH_PROMO_MAX_REDEMPTIONS = 30
export const LAUNCH_PROMO_DISCOUNT_PERCENT = 20
export const LAUNCH_PROMO_RESERVATION_MINUTES = 30

const PLANS = Object.freeze({
  guild: Object.freeze({
    label: 'GUILD',
    regularQuarterCents: 4797,
    introQuarterCents: 3838,
    productEnv: 'LEMON_SQUEEZY_GUILD_LAUNCH_PRODUCT_ID',
    variantEnv: 'LEMON_SQUEEZY_GUILD_LAUNCH_VARIANT_ID',
  }),
  commander: Object.freeze({
    label: 'COMMANDER',
    regularQuarterCents: 7497,
    introQuarterCents: 5998,
    productEnv: 'LEMON_SQUEEZY_COMMANDER_LAUNCH_PRODUCT_ID',
    variantEnv: 'LEMON_SQUEEZY_COMMANDER_LAUNCH_VARIANT_ID',
  }),
})

function envInt(name) {
  const value = Number(String(process.env[name] || '').trim())
  return Number.isInteger(value) && value > 0 ? value : null
}

export function launchPromoSelection(planCode) {
  const plan = PLANS[String(planCode || '').toLowerCase()]
  if (!plan) return null
  const productId = envInt(plan.productEnv)
  const variantId = envInt(plan.variantEnv)
  const discountCode = String(process.env.LEMON_SQUEEZY_LAUNCH_DISCOUNT_CODE || '').trim()
  return { ...plan, planCode: String(planCode).toLowerCase(), productId, variantId, discountCode }
}

export function launchPromoReady() {
  return Boolean(
    launchPromoSelection('guild')?.productId &&
    launchPromoSelection('guild')?.variantId &&
    launchPromoSelection('commander')?.productId &&
    launchPromoSelection('commander')?.variantId &&
    launchPromoSelection('guild')?.discountCode
  )
}

export function launchPromoPlanForVariant(variantId) {
  const target = Number(variantId)
  if (!Number.isInteger(target)) return null
  for (const planCode of ['guild','commander']) {
    const selection = launchPromoSelection(planCode)
    if (selection?.variantId === target) {
      return { planCode, billingPeriod:'quarterly', productId:selection.productId, variantId:selection.variantId, promotionCode:LAUNCH_PROMO_CODE }
    }
  }
  return null
}

export function formatUsd(cents) {
  return '$' + (Number(cents || 0) / 100).toFixed(2)
}
