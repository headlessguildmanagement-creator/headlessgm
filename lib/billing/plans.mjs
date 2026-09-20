import { launchPromoPlanForVariant } from './promo.mjs'

const DEFAULT_TEST_PRODUCTS = Object.freeze({
  guild: Object.freeze({
    monthly: Object.freeze({ productId: 1374346, variantId: 2147276 }),
    annual: Object.freeze({ productId: 1374352, variantId: 2147284 }),
  }),
  commander: Object.freeze({
    monthly: Object.freeze({ productId: 1374351, variantId: 2147283 }),
    annual: Object.freeze({ productId: 1374353, variantId: 2147285 }),
  }),
})

function envInt(name, fallback) {
  const raw = String(process.env[name] || '').trim()
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function isLemonTestMode() {
  return String(process.env.LEMON_SQUEEZY_TEST_MODE || 'true').toLowerCase() !== 'false'
}

export function billingCatalog() {
  if (isLemonTestMode()) return {
    guild: {
      monthly: { productId: envInt('LEMON_SQUEEZY_GUILD_MONTHLY_PRODUCT_ID', DEFAULT_TEST_PRODUCTS.guild.monthly.productId), variantId: envInt('LEMON_SQUEEZY_GUILD_MONTHLY_VARIANT_ID', DEFAULT_TEST_PRODUCTS.guild.monthly.variantId) },
      annual: { productId: envInt('LEMON_SQUEEZY_GUILD_ANNUAL_PRODUCT_ID', DEFAULT_TEST_PRODUCTS.guild.annual.productId), variantId: envInt('LEMON_SQUEEZY_GUILD_ANNUAL_VARIANT_ID', DEFAULT_TEST_PRODUCTS.guild.annual.variantId) },
    },
    commander: {
      monthly: { productId: envInt('LEMON_SQUEEZY_COMMANDER_MONTHLY_PRODUCT_ID', DEFAULT_TEST_PRODUCTS.commander.monthly.productId), variantId: envInt('LEMON_SQUEEZY_COMMANDER_MONTHLY_VARIANT_ID', DEFAULT_TEST_PRODUCTS.commander.monthly.variantId) },
      annual: { productId: envInt('LEMON_SQUEEZY_COMMANDER_ANNUAL_PRODUCT_ID', DEFAULT_TEST_PRODUCTS.commander.annual.productId), variantId: envInt('LEMON_SQUEEZY_COMMANDER_ANNUAL_VARIANT_ID', DEFAULT_TEST_PRODUCTS.commander.annual.variantId) },
    },
  }

  return {
    guild: {
      monthly: { productId: envInt('LEMON_SQUEEZY_GUILD_MONTHLY_PRODUCT_ID', null), variantId: envInt('LEMON_SQUEEZY_GUILD_MONTHLY_VARIANT_ID', null) },
      annual: { productId: envInt('LEMON_SQUEEZY_GUILD_ANNUAL_PRODUCT_ID', null), variantId: envInt('LEMON_SQUEEZY_GUILD_ANNUAL_VARIANT_ID', null) },
    },
    commander: {
      monthly: { productId: envInt('LEMON_SQUEEZY_COMMANDER_MONTHLY_PRODUCT_ID', null), variantId: envInt('LEMON_SQUEEZY_COMMANDER_MONTHLY_VARIANT_ID', null) },
      annual: { productId: envInt('LEMON_SQUEEZY_COMMANDER_ANNUAL_PRODUCT_ID', null), variantId: envInt('LEMON_SQUEEZY_COMMANDER_ANNUAL_VARIANT_ID', null) },
    },
  }
}

export function billingSelection(planCode, billingPeriod) {
  const plan = String(planCode || '').toLowerCase()
  const period = String(billingPeriod || '').toLowerCase()
  if (!['guild','commander'].includes(plan) || !['monthly','annual'].includes(period)) return null
  return billingCatalog()[plan]?.[period] || null
}

export function billingPlanForVariant(variantId) {
  const target = Number(variantId)
  if (!Number.isInteger(target)) return null
  const catalog = billingCatalog()
  for (const planCode of ['guild','commander']) {
    for (const billingPeriod of ['monthly','annual']) {
      const item = catalog[planCode][billingPeriod]
      if (item?.variantId === target) return { planCode, billingPeriod, ...item }
    }
  }
  return launchPromoPlanForVariant(target)
}

export function billingIntegrationReady() {
  const catalog = billingCatalog()
  return Boolean(
    process.env.LEMON_SQUEEZY_API_KEY &&
    process.env.LEMON_SQUEEZY_STORE_ID &&
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET &&
    catalog.guild.monthly.variantId &&
    catalog.guild.annual.variantId &&
    catalog.commander.monthly.variantId &&
    catalog.commander.annual.variantId
  )
}
