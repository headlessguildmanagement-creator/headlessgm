import test from 'node:test'
import assert from 'node:assert/strict'
import { selectPuppetTurns, allocateOfficerExcess, isPuppet96hPenalty } from '../lib/puppet-engine.mjs'

function members(count) { return Array.from({length:count},(_,i)=>({id:`p${i+1}`,status:'active',created_at:'2026-08-01T00:00:00Z'})) }
function queue(count){ return Array.from({length:count},(_,i)=>({guild_member_id:`p${i+1}`,position:i+1,is_active:true})) }

test('current cycle rolls into next cycle without duplicate member in same event',()=>{
  const all=members(12)
  const done=new Set(all.slice(0,8).map(x=>x.id))
  const r=selectPuppetTurns({members:all,queue:queue(12),completedIds:done,currentCycle:1,requestedCount:8,eventStartsAt:'2026-09-10T12:30:00Z'})
  assert.deepEqual(r.assignments.slice(0,4).map(x=>x.guild_member_id),['p9','p10','p11','p12'])
  assert.deepEqual(r.assignments.slice(4).map(x=>x.guild_member_id),['p1','p2','p3','p4'])
  assert.equal(new Set(r.assignments.map(x=>x.guild_member_id)).size,8)
  assert.equal(r.counts.rollover,4)
  assert.equal(r.cycleCanFinish,true)
})

test('cannot bid skips member and still lets cycle finish',()=>{
  const all=members(12)
  const done=new Set(all.slice(0,8).map(x=>x.id))
  const r=selectPuppetTurns({members:all,queue:queue(12),completedIds:done,cannotBidIds:new Set(['p10']),currentCycle:1,requestedCount:8,eventStartsAt:'2026-09-10T12:30:00Z'})
  assert.ok(!r.assignments.some(x=>x.guild_member_id==='p10'))
  assert.equal(r.cycleCanFinish,true)
  assert.equal(r.counts.rollover,5)
})

test('deferred and approved appeal have priority over normal queue',()=>{
  const all=members(6)
  const r=selectPuppetTurns({members:all,queue:queue(6),currentCycle:2,requestedCount:4,eventStartsAt:'2026-09-10T12:30:00Z',deferred:[{id:'d',guild_member_id:'p5',source_cycle:1,created_at:'2026-09-01'}],appeals:[{id:'a',guild_member_id:'p6',source_cycle:1,status:'approved',submitted_at:'2026-09-02'}]})
  assert.deepEqual(r.assignments.slice(0,2).map(x=>[x.guild_member_id,x.turn_kind]),[['p5','deferred'],['p6','appeal']])
})

test('96-hour penalty follows before/after 20:30 Manila rule',()=>{
  assert.equal(isPuppet96hPenalty({created_at:'2026-09-01T10:00:00Z'},'2026-09-04T12:30:00Z'),true)
  assert.equal(isPuppet96hPenalty({created_at:'2026-09-01T10:00:00Z'},'2026-09-05T12:30:00Z'),false)
})

test('officer excess round robin respects caps and persists pointer',()=>{
  const officers=[{id:'o1'},{id:'o2'},{id:'o3'}]
  const r=allocateOfficerExcess({category:'light_dark_feather',quantity:4,officers,startIndex:1,cap:2,existing:new Map([['o2',1]])})
  assert.deepEqual(r.rows.map(x=>[x.guild_member_id,x.quantity]),[['o2',1],['o3',2],['o1',1]])
  assert.equal(r.unassigned,0)
  assert.equal(r.nextIndex,0)
})
