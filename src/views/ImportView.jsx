import React, { useRef, useState } from 'react'
import { GREEN, FAINT, INK, LINE, LINE_SOFT, SUB, fromISO, colorOf, DAYS } from '../logic.js'
import { importTimetable, importSchedule } from '../importer.js'
import { getApiKey } from '../storage.js'
import useWindowWidth from '../useWindowWidth.js'

export default function ImportView({ data, setData, go, goImport, setSnack, kind }) {
  const { isMobile } = useWindowWidth()
  const [stage, setStage] = useState('idle') // idle | loading | review
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [imp, setImp] = useState(null) // timetable: {rec, unc, preview} / schedule: {rows, preview}
  const fileRef = useRef()
  const lastFile = useRef(null)

  // 시간표·일정 편집은 설정 화면에 있으므로 그쪽으로 돌아간다
  const back = 'setup'
  const backLabel = '← 돌아가기'
  const hasKey = !!getApiKey()

  const run = async file => {
    if (!file) return
    lastFile.current = file
    setFileName(file.name)
    setError('')
    setStage('loading')
    try {
      const result = kind === 'timetable'
        ? await importTimetable(file, data.classes)
        : await importSchedule(file, data.semStart ? fromISO(data.semStart).getFullYear() : new Date().getFullYear())
      setImp(result)
      setStage('review')
    } catch (e) {
      setError(e.message || '인식에 실패했습니다.')
      setStage('idle')
    }
  }

  const uncCount = imp ? (kind === 'timetable' ? Object.keys(imp.unc).length : imp.rows.filter(r => r.uncertain).length) : 0
  const note = stage === 'review' ? (uncCount > 0 ? '확인 필요 ' + uncCount + '건' : '확인이 끝났습니다.') : ''

  const applyTimetable = () => {
    const prev = data.pattern
    const prevClasses = data.classes
    const newClasses = [...data.classes]
    Object.values(imp.rec).forEach(c => {
      if (!newClasses.includes(c)) newClasses.push(c)
    })
    setData(d => ({ ...d, pattern: { ...imp.rec }, classes: newClasses }))
    go('setup')
    setSnack({ text: '시간표를 적용했습니다.', kind: 'pattern', prev, prevClasses })
  }

  const applySchedule = () => {
    const prev = data.events
    const picked = imp.rows.filter(r => r.checked)
    const dup = e => data.events.some(x => x.start === e.start && x.name === e.name)
    const added = picked
      .filter(e => !dup(e))
      .map((e, i) => ({ id: Date.now() + i, start: e.start, end: e.end, name: e.name, type: e.type }))
    setData(d => ({ ...d, events: [...d.events, ...added] }))
    go('setup')
    setSnack({ text: added.length + '개 일정을 추가했습니다.', kind: 'events', prev })
  }

  return (
    <div style={{ width: '100%', maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, paddingBottom: 22 }}>
        <button onClick={() => go(back)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: SUB }}>{backLabel}</button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>파일에서 가져오기</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: SUB }}>{note}</div>
      </div>

      {stage === 'idle' && (
        <div>
          <div
            onClick={() => hasKey && fileRef.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (hasKey) run(e.dataTransfer.files[0]) }}
            style={{
              maxWidth: 520, margin: '28px auto 0', border: '1.5px dashed #C2BDB4', borderRadius: 12,
              background: '#FFFFFF', padding: '52px 28px', textAlign: 'center',
              cursor: hasKey ? 'pointer' : 'default', boxSizing: 'border-box',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={hasKey ? GREEN : FAINT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 8 12 3 17 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {hasKey ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 16 }}>{kind === 'timetable' ? '시간표' : '학사일정'} 파일 올리기</div>
                <div style={{ fontSize: 13, color: SUB, marginTop: 7 }}>누르거나 파일을 끌어다 놓으세요</div>
                <div style={{ display: 'inline-block', marginTop: 14, fontSize: 12, color: FAINT, background: '#F2F4F6', borderRadius: 999, padding: '4px 12px' }}>엑셀 · CSV · PDF · 이미지</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 16 }}>파일 인식을 사용하려면 API 키가 필요합니다</div>
                <div style={{ fontSize: 13, color: SUB, marginTop: 7 }}>설정 &gt; 파일 인식에 OpenRouter 키를 등록해주세요.</div>
              </>
            )}
          </div>
          {error && <div style={{ maxWidth: 520, margin: '14px auto 0', fontSize: 13, color: '#D9480F', textAlign: 'center' }}>{error}</div>}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf,image/*" style={{ display: 'none' }} onChange={e => run(e.target.files[0])} />
        </div>
      )}

      {stage === 'loading' && (
        <div style={{ padding: '64px 0', textAlign: 'center', fontSize: 14, color: SUB }}>파일을 읽고 있습니다…</div>
      )}

      {stage === 'review' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 22 : 30, alignItems: 'start' }}>
          <div>
            <div style={{ border: '1px solid ' + LINE, borderRadius: 8, padding: 16, background: '#FFFFFF' }}>
              {imp.preview.kind === 'image' ? (
                <img src={imp.preview.src} alt="원본" style={{ width: '100%', display: 'block', filter: 'grayscale(1) contrast(0.9)', opacity: 0.9 }} />
              ) : (
                <pre style={{ margin: 0, fontSize: 11, color: SUB, whiteSpace: 'pre-wrap', maxHeight: 420, overflow: 'auto', fontFamily: 'inherit' }}>
                  {imp.preview.text.slice(0, 4000)}
                </pre>
              )}
              <div style={{ marginTop: 11, fontSize: 12, color: FAINT }}>{fileName} · 원본</div>
            </div>
          </div>
          <div>
            {kind === 'timetable' ? (
              <TimetableReview data={data} imp={imp} setImp={setImp} />
            ) : (
              <ScheduleReview imp={imp} setImp={setImp} />
            )}
            <div style={{ marginTop: 11, fontSize: 12, color: FAINT }}>
              {kind === 'timetable' ? '인식 결과 · 칸을 눌러 수정합니다.' : '인식 결과 · 반영할 항목만 선택합니다.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginTop: 18 }}>
              <button onClick={() => run(lastFile.current)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 14, color: SUB }}>다시 읽기</button>
              <button
                onClick={kind === 'timetable' ? applyTimetable : applySchedule}
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: GREEN }}
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TimetableReview({ data, imp, setImp }) {
  const eDays = ['월', '화', '수', '목', '금']
  const classes = [...new Set([...data.classes, ...Object.values(imp.rec)])]
  const pv = { classes, colors: data.colors } // 새로 인식된 반도 순번 색으로 미리 보이게
  const rows = []
  for (let p = 1; p <= 7; p++) {
    const cells = []
    for (let dow = 1; dow <= 5; dow++) {
      const k = dow + '-' + p
      const name = imp.rec[k] || ''
      const unc = !!imp.unc[k]
      cells.push(
        <div
          key={k}
          onClick={() => {
            const im = { ...imp, rec: { ...imp.rec }, unc: { ...imp.unc } }
            if (im.unc[k]) delete im.unc[k]
            else {
              const opts = [...classes, '']
              const i = opts.indexOf(im.rec[k] || '')
              const next = opts[(i + 1) % opts.length]
              if (next) im.rec[k] = next
              else delete im.rec[k]
            }
            setImp(im)
          }}
          style={{
            position: 'relative', minHeight: 42, padding: '8px 12px',
            borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT,
            cursor: 'pointer', background: name && !unc ? colorOf(pv, name) : '#FFFFFF',
          }}
        >
          {unc && <div style={{ position: 'absolute', inset: 3, border: '1px dashed ' + FAINT, borderRadius: 4 }} />}
          <div style={{ position: 'relative', fontSize: 13, fontWeight: 500 }}>{name}</div>
        </div>
      )
    }
    rows.push(
      <div key={p} style={{ display: 'contents' }}>
        <div style={{ borderTop: '1px solid ' + LINE_SOFT, padding: '8px 0 0 15px', fontSize: 12, color: FAINT }}>{p}</div>
        {cells}
      </div>
    )
  }
  return (
    <div style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', userSelect: 'none' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(5,1fr)' }}>
        <div />
        {eDays.map(d => (
          <div key={d} style={{ padding: '9px 12px 7px', borderLeft: '1px solid ' + LINE_SOFT, fontSize: 13, color: SUB, fontWeight: 500 }}>{d}</div>
        ))}
        {rows}
      </div>
    </div>
  )
}

function ScheduleReview({ imp, setImp }) {
  const toggle = i => {
    const rows = imp.rows.slice()
    rows[i] = { ...rows[i], checked: !rows[i].checked, uncertain: false }
    setImp({ ...imp, rows })
  }
  const fmt = r => {
    const d1 = fromISO(r.start)
    if (r.start === r.end) return d1.getMonth() + 1 + '.' + d1.getDate() + ' ' + DAYS[d1.getDay()]
    const d2 = fromISO(r.end)
    return d1.getMonth() + 1 + '.' + d1.getDate() + '–' + (d2.getMonth() + 1) + '.' + d2.getDate()
  }
  return (
    <div style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', padding: '4px 16px' }}>
      {imp.rows.map((r, i) => (
        <div
          key={i}
          onClick={() => toggle(i)}
          style={{
            display: 'grid', gridTemplateColumns: '20px 92px 1fr auto auto', gap: 12, padding: '12px 0',
            borderBottom: i < imp.rows.length - 1 ? '1px solid ' + LINE_SOFT : 'none',
            fontSize: 14, alignItems: 'baseline', cursor: 'pointer',
            opacity: r.checked ? 1 : 0.45,
          }}
        >
          <input type="checkbox" checked={r.checked} readOnly style={{ accentColor: GREEN, margin: 0, transform: 'translateY(2px)' }} />
          <div style={{ color: SUB, fontSize: 13 }}>{fmt(r)}</div>
          <div style={{ fontWeight: 500 }}>{r.name}</div>
          <div style={{ color: FAINT, fontSize: 13 }}>{r.type === '휴업일' ? '휴업' : r.type}</div>
          <div style={{ fontSize: 12, color: r.uncertain ? '#D9480F' : 'transparent' }}>확인 필요</div>
        </div>
      ))}
    </div>
  )
}
