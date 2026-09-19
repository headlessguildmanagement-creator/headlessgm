-- Normalize downgraded/current FREE workspaces to the simple auction entitlement.
update public.guild_auction_rules r
set
  feather_mode = case when r.feather_mode in ('ffa','random') then r.feather_mode else 'ffa' end,
  puppet_mode = case when r.puppet_mode in ('ffa','random') then r.puppet_mode else 'ffa' end,
  light_dark_feather_cap = null,
  time_space_feather_cap = null,
  puppet_fragment_cap = null,
  illusion_fragment_cap = null,
  version = r.version + 1,
  updated_at = now()
from public.guilds g
where g.id = r.guild_id
  and g.plan_code = 'free';
