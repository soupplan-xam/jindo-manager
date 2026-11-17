import React, { useEffect, useMemo, useRef, useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, WARN, SECTION_TITLE, toISO } from '../logic.js'
import { REASONS, KINDS, DEFAULT_DOCS, DEFAULT_TEMPLATE, buildMessage, docsFor } from '../homeroom.js'
import { DateRangeField } from './DateField.jsx'
import useWindowWidth from '../useWindowWidth.js'
import { loadFormFile, saveFormFile, clearFormFile } from '../formFile.js'

// 담임 — 출결 안내 메시지를 골라서 만들고 복사한다. e알리미 등에 붙여 넣어 보낸다.
// 학생 이름·사유는 저장하지 않는다. 학교·반·담임 이름과 문구 틀만 저장한다.
export default function HomeroomView({ data, setData, setSnack }) {
  const { isMobile } = useWindowWidth()
  const hr = data.homeroom
  const setHr = p => setData(d => ({ ...d, homeroom: { ...d.homeroom, ...p } }))
  const today = toISO(new Date())
  const [form, setForm] = useState({ start: today, end: today, name: '', reason: '질병', kind: '지각', docs: docsFor('질병') })
  const set = p => { setForm(f => ({ ...f, ...p })); setEdited(null) }
  const [edited, setEdited] = useState(null) // 미리보기에서 손으로 고친 글
  const [tplOpen, setTplOpen] = useState(!hr.school && !hr.teacher)
  const boxRef = useRef(null)

  const message = useMemo(() => buildMessage(hr, form), [hr, form])
  const text = edited ?? message
  const missing = [!form.name.trim() && '학생 이름', !hr.teacher && '담임 이름'].filter(Boolean)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setSnack({ text: '메시지를 복사했습니다. e알리미에 붙여 넣어 보내세요.', kind: 'none', ms: 4000 })
    } catch {
      // 클립보드가 막힌 브라우저 — 글을 선택해 두어 Ctrl+C 로 복사하게 한다
      const el = boxRef.current
      if (el) { el.focus(); el.select() }
      setSnack({ text: '자동 복사가 막혀 글을 선택해 두었습니다. Ctrl+C(휴대폰은 길게 눌러 복사)로 복사하세요.', kind: 'none', ms: 6000 })
    }
  }
  // 학부모의견서 양식 — 파일은 이 기기에만, 링크는 기기 연동으로 함께
  const [formFile, setFormFile] = useState(null) // { name, type, blob }
  useEffect(() => { loadFormFile().then(f => setFormFile(f || null)).catch(() => {}) }, [])
  const note = (t, ms = 4000) => setSnack({ text: t, kind: 'none', ms })
  const pickFile = async e => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 20 * 1024 * 1024) { note('파일이 너무 큽니다(20MB까지).'); return }
    try { await saveFormFile(f); setFormFile({ name: f.name, type: f.type, blob: f }); note('「' + f.name + '」을 이 기기에 넣어 두었습니다.') } catch { note('파일을 저장하지 못했습니다(브라우저 저장 공간이 막혀 있을 수 있습니다).', 6000) }
  }
  const asFile = () => new File([formFile.blob], formFile.name, { type: formFile.type || 'application/octet-stream' })
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(formFile.blob)
    a.download = formFile.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  }
  const canShare = !!(formFile && navigator.canShare && (() => { try { return navigator.canShare({ files: [asFile()] }) } catch { return false } })())
  const share = async () => { try { await navigator.share({ files: [asFile()], title: formFile.name }) } catch { /* 취소 */ } }
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(hr.formUrl.trim()); note('양식 링크를 복사했습니다.') } catch { note('자동 복사가 막혀 있습니다. 링크 칸에서 직접 복사해 주세요.', 6000) }
  }
  const nextStudent = () => { setForm(f => ({ ...f, name: '' })); setEdited(null) }

  const chips = (list, value, onPick, label) => (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {list.map(v => {
        const on = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(v)}
            style={{
              border: '1px solid ' + (on ? GREEN : LINE), borderRadius: 999, padding: '6px 14px', cursor: 'pointer',
              background: on ? '#E9F6FE' : '#FFFFFF', color: on ? GREEN : SUB, fontSize: 14, fontWeight: on ? 700 : 500,
            }}
          >
            {v}
          </button>
        )
      })}
    </div>
  )

  const row = (label, children) => (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 6 : 14, alignItems: isMobile ? 'stretch' : 'center', padding: '12px 0', borderBottom: '1px solid ' + LINE_SOFT }}>
      <div style={{ width: isMobile ? 'auto' : 92, flex: 'none', fontSize: 13, fontWeight: 700, color: SUB }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )

  const field = { border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 14, padding: '7px 10px', boxSizing: 'border-box' }

  return (
    <div style={{ width: '100%', maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: isMobile ? 18 : 32, alignItems: 'start' }}>
      <section aria-label="출결 안내 만들기" style={{ minWidth: 0 }}>
        <div style={{ ...SECTION_TITLE, marginBottom: 4 }}>출결 안내 메시지</div>
        <div style={{ fontSize: 12.5, color: FAINT, marginBottom: 6 }}>고르면 {isMobile ? '아래' : '오른쪽'}에 메시지가 완성됩니다. 학생 이름과 사유는 저장하지 않습니다.</div>
        {row('날짜', (
          <DateRangeField start={form.start} end={form.end} onChange={r => set(r)} labels={['출결 시작일', '출결 종료일']} keepLength />
        ))}
        {row('학생 이름', (
          <input
            id="hr-name"
            value={form.name}
            onChange={e => set({ name: e.target.value })}
            placeholder="예: 홍길동"
            autoComplete="off"
            style={{ ...field, width: isMobile ? '100%' : 200 }}
          />
        ))}
        {row('사유', chips(REASONS, form.reason, v => set({ reason: v, docs: docsFor(v) }), '사유'))}
        {row('출결', chips(KINDS, form.kind, v => set({ kind: v }), '출결 종류'))}
        {row('서류 안내', (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['질병', '인정'].map(k => (
              <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13.5, color: INK, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.docs[k]} onChange={() => set({ docs: { ...form.docs, [k]: !form.docs[k] } })} style={{ accentColor: GREEN, margin: 0, transform: 'translateY(2px)' }} />
                <span>{k === '질병' ? '질병 증빙 안내' : '출석인정 서류 안내'}</span>
              </label>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={() => setTplOpen(o => !o)}
            aria-expanded={tplOpen}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: SUB }}
          >
            {tplOpen ? '▾' : '▸'} 학교·반·담임 이름과 문구 틀
          </button>
          {tplOpen && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input aria-label="학교 이름" value={hr.school} onChange={e => setHr({ school: e.target.value })} placeholder="학교 (예: ○○고등학교)" style={{ ...field, flex: '2 1 160px', minWidth: 0 }} />
                <input aria-label="반" value={hr.cls} onChange={e => setHr({ cls: e.target.value })} placeholder="반 (예: 1학년 8반)" style={{ ...field, flex: '1 1 110px', minWidth: 0 }} />
                <input aria-label="담임 이름" value={hr.teacher} onChange={e => setHr({ teacher: e.target.value })} placeholder="담임 이름" style={{ ...field, flex: '1 1 100px', minWidth: 0 }} />
              </div>
              <label style={{ fontSize: 12, color: FAINT }}>
                문구 틀 — 중괄호 칸이 고른 값으로 바뀝니다: {'{학교} {반} {담임} {날짜} {이름} {사유} {출결} {서류안내}'}
                <textarea
                  value={hr.template}
                  onChange={e => { setHr({ template: e.target.value }); setEdited(null) }}
                  rows={10}
                  style={{ ...field, display: 'block', width: '100%', marginTop: 5, fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>
              {['질병', '인정'].map(k => (
                <label key={k} style={{ fontSize: 12, color: FAINT }}>
                  {k === '질병' ? '질병 증빙 안내 문장' : '출석인정 서류 안내 문장'}
                  <input
                    value={(hr.docs || {})[k] ?? DEFAULT_DOCS[k]}
                    onChange={e => { setHr({ docs: { ...DEFAULT_DOCS, ...(hr.docs || {}), [k]: e.target.value } }); setEdited(null) }}
                    style={{ ...field, display: 'block', width: '100%', marginTop: 5, fontSize: 13 }}
                  />
                </label>
              ))}
              {(hr.template !== DEFAULT_TEMPLATE || JSON.stringify({ ...DEFAULT_DOCS, ...(hr.docs || {}) }) !== JSON.stringify(DEFAULT_DOCS)) && (
                <button
                  type="button"
                  onClick={() => { setHr({ template: DEFAULT_TEMPLATE, docs: { ...DEFAULT_DOCS } }); setEdited(null) }}
                  style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: WARN }}
                >
                  처음 문구로 되돌리기
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section aria-label="완성된 메시지" style={{ minWidth: 0, position: isMobile ? 'static' : 'sticky', top: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <div style={SECTION_TITLE}>미리보기</div>
          <span style={{ fontSize: 12, color: FAINT }}>{edited != null ? '손으로 고친 글' : '여기서 바로 고쳐도 됩니다'}</span>
          <div style={{ flex: 1 }} />
          {edited != null && (
            <button type="button" onClick={() => setEdited(null)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: WARN }}>고친 것 취소</button>
          )}
        </div>
        <textarea
          ref={boxRef}
          aria-label="보낼 메시지"
          value={text}
          onChange={e => setEdited(e.target.value)}
          rows={isMobile ? 12 : 15}
          style={{ ...field, width: '100%', fontSize: 14, lineHeight: 1.7, resize: 'vertical', fontFamily: 'inherit', color: INK, background: '#FFFFFF' }}
        />
        {missing.length > 0 && (
          <div role="status" style={{ marginTop: 6, fontSize: 12.5, color: WARN }}>{missing.join(', ')}이(가) 비어 있습니다.</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={copy}
            style={{ border: 'none', borderRadius: 8, background: GREEN, color: '#FFFFFF', padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            메시지 복사
          </button>
          <button
            type="button"
            onClick={() => { nextStudent(); setTimeout(() => document.getElementById('hr-name')?.focus(), 0) }}
            style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', color: SUB, padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}
          >
            다음 학생
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: FAINT, lineHeight: 1.6 }}>
          복사한 글을 e알리미 메시지 작성 칸에 붙여 넣어 보내세요. 이 앱은 메시지를 직접 보내지 않습니다.
        </div>

        {/* 학부모의견서 양식 — 출석인정 서류 안내를 켰을 때 */}
        {form.docs.인정 && (
          <div aria-label="학부모의견서 양식" style={{ marginTop: 16, border: '1px solid ' + LINE, borderRadius: 12, padding: '12px 14px', background: '#FFFFFF' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>학부모의견서 양식</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 12.5, color: SUB, fontWeight: 700, width: 34, flex: 'none' }}>파일</span>
              {formFile ? (
                <>
                  <span style={{ fontSize: 13, color: INK, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} title={formFile.name}>{formFile.name}</span>
                  <button type="button" onClick={download} style={{ border: 'none', borderRadius: 8, background: GREEN, color: '#FFFFFF', padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>내려받기</button>
                  {canShare && <button type="button" onClick={share} style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', color: SUB, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>공유</button>}
                  <label style={{ fontSize: 12.5, color: GREEN, cursor: 'pointer' }}>바꾸기<input type="file" onChange={pickFile} style={{ display: 'none' }} /></label>
                  <button type="button" onClick={async () => { await clearFormFile().catch(() => {}); setFormFile(null) }} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: WARN }}>지우기</button>
                </>
              ) : (
                <label style={{ border: '1px dashed ' + LINE, borderRadius: 8, padding: '6px 12px', fontSize: 13, color: GREEN, fontWeight: 700, cursor: 'pointer' }}>+ 양식 파일 넣어 두기<input type="file" onChange={pickFile} style={{ display: 'none' }} /></label>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 12.5, color: SUB, fontWeight: 700, width: 34, flex: 'none' }}>링크</span>
              <input aria-label="학부모의견서 양식 링크" value={hr.formUrl || ''} onChange={e => { setHr({ formUrl: e.target.value }); setEdited(null) }} placeholder="양식 링크 (예: 구글 드라이브 공유 링크)" style={{ ...field, flex: '1 1 200px', minWidth: 0, fontSize: 13 }} />
              {(hr.formUrl || '').trim() && <button type="button" onClick={copyLink} style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', color: SUB, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>링크 복사</button>}
            </div>
            {(hr.formUrl || '').trim() && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 13, color: INK, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.link !== false} onChange={() => set({ link: form.link === false })} style={{ accentColor: GREEN, margin: 0 }} />
                메시지에 양식 링크 넣기
              </label>
            )}
            <div style={{ marginTop: 8, fontSize: 11.5, color: FAINT, lineHeight: 1.6 }}>
              파일은 이 기기의 브라우저에만 넣어 둡니다(다른 기기에서는 따로 넣어야 합니다). 내려받아 e알리미에 첨부하세요.
              링크는 기기 연동으로 함께 저장되고, 메시지에 넣으면 학부모가 바로 받을 수 있습니다.
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
