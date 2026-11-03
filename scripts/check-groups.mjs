import assert from 'node:assert/strict'
import { gradeOf, progressGroups } from '../src/logic.js'
import { defaultData } from '../src/storage.js'
assert.equal(gradeOf('1-8'), '1'); assert.equal(gradeOf('2-4'), '2'); assert.equal(gradeOf('2학년 3반'), '2')
assert.equal(gradeOf('3.2'), '3'); assert.equal(gradeOf('수학A'), ''); assert.equal(gradeOf('10-1'), '10')
const d = { ...defaultData(), subjects: ['국어', '독서'], clsSubject: { '1-8': '국어', '1-9': '국어', '2-4': '독서', '2-3': '독서', '2-2': '독서' } }
const g = progressGroups(d, ['2-4', '1-8', '2-3', '1-9', '2-2'])
assert.deepEqual(g.map(x => [x.label, x.classes]), [['1학년', ['1-8', '1-9']], ['2학년', ['2-4', '2-3', '2-2']]])
// 같은 학년에 과목이 둘이면 과목도 붙여 따로 견준다
const d2 = { ...d, clsSubject: { ...d.clsSubject, '2-2': '국어' } }
assert.deepEqual(progressGroups(d2, ['2-4', '2-2']).map(x => x.label), ['2학년 · 국어', '2학년 · 독서'])
console.log('PASS: grade from class name, grade/subject groups')
