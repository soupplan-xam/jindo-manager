import assert from 'node:assert/strict'
import { compute, progressFor, pickTargetExam } from '../src/logic.js'
import { defaultData, coerceData } from '../src/storage.js'
const d = defaultData()
Object.assign(d, { semStart: '2026-10-01', semEnd: '2026-11-30', classes: ['A','B'], pattern: {'1-1':'A','2-1':'A','3-1':'B','4-1':'B','5-1':'A'}, events: [
  {id:1, type:'고사', name:'1차', start:'2026-10-12', end:'2026-10-15'},
  {id:2, type:'고사', name:'2차', start:'2026-11-09', end:'2026-11-12'}
]})
d.cfg.examReset = true; d.cfg.examId = 1
let c=compute(d)
assert.equal(c.exam.id,2)
assert.equal(c.sessions['2026-10-16|1'].num,1)
assert.equal(c.sessions['2026-10-21|1'].num,1)
assert.deepEqual(progressFor(d,c,'B','2026-10-16'),{current:0,total:6,remaining:6})
assert.deepEqual(progressFor(d,c,'A','2026-10-20'),{current:3,total:10,remaining:7})
assert.equal(progressFor(d,c,'A','2026-11-30').remaining,0)
d.cfg.targetExamId='1'; c=compute(d)
assert.equal(c.exam.id,1)
assert.equal(c.sessions['2026-10-16|1'].num,1)
d.cfg.targetExamId='2'; d.cancels['2026-10-19|1']={kind:'perf'}; c=compute(d)
assert.deepEqual(progressFor(d,c,'A','2026-10-20'),{current:2,total:9,remaining:7})
d.cfg.targetExamId='semester'; assert.equal(pickTargetExam(d),null)
d.cfg.targetExamId='deleted'; assert.equal(pickTargetExam(d).id,2)
d.cfg.examReset=false; delete d.cfg.targetExamId; assert.equal(pickTargetExam(d).id,1)
const legacy=coerceData({...d,cfg:{examReset:true,examId:1},contents:{수학:{1:'기존 내용'}}})
assert.equal(legacy.cfg.targetExamId,null)
assert.equal(legacy.contents.수학[1],'기존 내용')
assert.equal(compute(legacy).exam.id,2)
console.log('PASS: independent reset/target, first-class boundary, remaining counts, cancellations, fallback, legacy data')
