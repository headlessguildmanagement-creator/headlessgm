with rooc as (
  select id from public.game_presets where name = 'Ragnarok Origin Classic' limit 1
)
update public.game_jobs
set is_active = false
where game_preset_id = (select id from rooc);

with rooc as (
  select id from public.game_presets where name = 'Ragnarok Origin Classic' limit 1
)
update public.game_jobs
set is_active = true,
    label = case code
      when 'sniper' then 'Sniper'
      when 'priest' then 'Priest'
      when 'lord_knight' then 'Lord Knight'
      when 'wizard' then 'Wizard'
      when 'assassin' then 'Assassin'
      when 'mastersmith' then 'Mastersmith'
      when 'gypsy' then 'Gypsy'
      when 'sage' then 'Sage'
      when 'paladin' then 'Paladin'
      when 'alchemist' then 'Alchemist'
      when 'minstrel' then 'Minstrel'
      when 'stalker' then 'Stalker'
      when 'summoner' then 'Doram'
      when 'rebellion' then 'Rebellion'
      else label
    end,
    sort_order = case code
      when 'sniper' then 10
      when 'priest' then 20
      when 'lord_knight' then 30
      when 'wizard' then 40
      when 'assassin' then 50
      when 'mastersmith' then 60
      when 'gypsy' then 70
      when 'sage' then 80
      when 'paladin' then 90
      when 'alchemist' then 100
      when 'minstrel' then 110
      when 'stalker' then 120
      when 'summoner' then 130
      when 'rebellion' then 140
      else sort_order
    end
where game_preset_id = (select id from rooc)
  and code in ('sniper','priest','lord_knight','wizard','assassin','mastersmith','gypsy','sage','paladin','alchemist','minstrel','stalker','summoner','rebellion');
