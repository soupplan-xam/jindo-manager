import React, { useEffect, useRef, useState } from 'react'
import { GREEN, FAINT, INK, LINE, SUB, WARN, RED, exportCSV, printSizes, fitScale } from '../logic.js'
import { getApiKey, setApiKey, getModel, setModel, exportJSON, importJSON, defaultData } from '../storage.js'
import { checkKey } from '../importer.js'
import DateField from './DateField.jsx'
import { SchoolWeatherSettings, BellSettings } from './TodaySettings.jsx'
import Modal from './Modal.jsx'

export default function SettingsModal({ data, setData, computed, today, setSnack, onClose, onResetSetup, onImport, onSchools }) {
  const [confirmClear, setConfirmClear] = useState(false)
  const cfg = data.cfg
  const weeks = cfg.printWeeks || 1 // 인쇄 범위 — 고를 수 있는 크기가 여기에 달렸다
  const [open, setOpen] = useState({ mode: true, sem: true, count: true, targetExam: true, view: false, dash: false, print: false, school: false, bells: false, install: false, data: false, file: false })
  const [canInstall, setCanInstall] = useState(() => !!window.__installPrompt)
  useEffect(() => {
    const on = () => setCanInstall(true)
    window.addEventListener('installable', on)
    return () => window.removeEventListener('installable', on)
  }, [])
  const installed = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
  const install = async () => {
    const p = window.__installPrompt
    if (!p) return
    p.prompt()
    try { await p.userChoice } catch { /* 닫음 */ }
    window.__installPrompt = null
    setCanInstall(false)
  }
  const [key, setKey] = useState(getApiKey)
  const [keyShown, setKeyShown] = useState(false)
  const [model, setModelState] = useState(getModel)
  const [apiStatus, setApiStatus] = useState('')
  const [dataError, setDataError] = useState('')
  const jsonRef = useRef()

  const patch = p => setData(d => ({ ...d, ...p }))
  const setCfg = p => setData(d => ({ ...d, cfg: { ...d.cfg, ...p } }))
  const toggleSec = id => setOpen(o => ({ ...o, [id]: !o[id] }))

  const exams = data.events.filter(e => e.type === '고사').slice().sort((a, b) => (a.start < b.start ? -1 : 1))

  const saveKey = v => {
    setKey(v)
    setApiKey(v)
    setApiStatus('')
  }
  const doCheck = async () => {
    if (!key) {
      setApiStatus('키를 먼저 입력해주세요.')
      return
    }
    setApiStatus('확인 중…')
    try {
      await checkKey(key)
      setApiStatus('연결됨 · 방금 확인')
    } catch {
      setApiStatus('연결 실패 · 키를 확인해주세요.')
    }
  }

  const loadFile = async file => {
    if (!file) return
    setDataError('')
    try {
      const loaded = await importJSON(file)
      const prev = data
      setData(loaded)
      setSnack({ text: '데이터를 불러왔습니다.', kind: 'all', prev })
      onClose()
    } catch (e) {
      setDataError(e.message)
    }
    jsonRef.current.value = ''
  }

  const Toggle = ({ on, onClick }) => (
    <button
      onClick={onClick}
      style={{
        width: 30, height: 16, border: '1px solid ' + (on ? GREEN : '#C5CCD3'), borderRadius: 9,
        background: on ? GREEN : '#FFFFFF', position: 'relative', cursor: 'pointer', padding: 0, flex: 'none',
      }}
    >
      <span style={{ position: 'absolute', top: 2.5, left: on ? 16 : 3, width: 9, height: 9, borderRadius: '50%', background: on ? '#FFFFFF' : FAINT, transition: 'left 150ms' }} />
    </button>
  )

  // 스위치는 라벨 바로 옆에 — 시선이 멀리 건너뛰지 않게
  const row = { display: 'flex', alignItems: 'center', gap: 10 }
  const SwitchRow = ({ label, on, onClick }) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'none',
        padding: '5px 0', cursor: 'pointer', fontSize: 14, color: INK, textAlign: 'left',
      }}
    >
      <Toggle on={on} onClick={onClick} />
      {label}
    </button>
  )
  const linkBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN, textAlign: 'left' }

  return (
    <Modal title="설정" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        <Sec open={open} toggleSec={toggleSec} id="sem" title="학기 설정">
          <div style={{ padding: '0 0 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: SUB }}>
              시작일
              <DateField value={data.semStart} onChange={v => patch({ semStart: v, semEnd: data.semEnd && data.semEnd >= v ? data.semEnd : v })} label="학기 시작일" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: SUB }}>
              종료일
              <DateField value={data.semEnd} onChange={v => patch({ semEnd: v })} near={data.semStart} min={data.semStart} label="학기 종료일" />
            </div>
          </div>
        </Sec>

        <Sec open={open} toggleSec={toggleSec} id="count" title="차시 카운팅">
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
            <SwitchRow label="고사 후 1차시부터 다시" on={cfg.examReset} onClick={() => setCfg({ examReset: !cfg.examReset })} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span>차시 초기화 기준 고사</span>
              {exams.length ? (
                <select
                  value={cfg.examId ?? exams[0].id}
                  onChange={e => setCfg({ examId: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
                  style={uSelect}
                >
                  {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  {exams.length > 1 && <option value="all">모든 고사 후마다</option>}
                </select>
              ) : (
                <span style={{ fontSize: 13, color: FAINT }}>일정에 고사를 추가하면 선택할 수 있습니다.</span>
              )}
            </div>
            {cfg.examReset && (
              <span style={{ fontSize: 12, color: FAINT, lineHeight: 1.5 }}>
                차시별 내용은 고사 전·후 구간마다 따로 적습니다. 차시별 내용 패널 위의 구간 버튼으로 바꿔 봅니다.
              </span>
            )}
          </div>
        </Sec>

        <Sec open={open} toggleSec={toggleSec} id="targetExam" title="진도 목표 고사">
          <div style={{ paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select aria-label="진도 목표 고사" value={cfg.targetExamId ?? ''}
              onChange={e => setCfg({ targetExamId: e.target.value || null })} style={uSelect}>
              <option value="">{cfg.examReset && cfg.examId === 'all' ? '자동 (다가오는 고사)' : '자동 (초기화 이후 다음 고사)'}</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              <option value="semester">학기 말까지</option>
            </select>
            <span style={{ fontSize: 12, color: FAINT }}>목표 고사는 반별 진도·남은 차시·D-day에 적용됩니다. 차시 초기화 기준과 따로 선택하세요.</span>
          </div>
        </Sec>

        <Sec open={open} toggleSec={toggleSec} id="view" title="글씨 크기">
          <div style={{ padding: '0 0 16px', display: 'flex', gap: 8 }}>
            {[[0.9, '작게'], [1, '보통'], [1.1, '크게'], [1.25, '더 크게']].map(([v, labelText]) => {
              const on = (cfg.fontScale || 1) === v
              return (
                <button
                  key={v}
                  onClick={() => setCfg({ fontScale: v })}
                  style={{
                    flex: 1, border: '1px solid ' + (on ? GREEN : LINE), borderRadius: 8, cursor: 'pointer',
                    background: on ? GREEN : '#FFFFFF', color: on ? '#FFFFFF' : SUB,
                    padding: '9px 0', fontSize: 12 + (v - 1) * 10, fontWeight: on ? 700 : 500,
                  }}
                >
                  {labelText}
                </button>
              )
            })}
          </div>
        </Sec>

        <Sec open={open} toggleSec={toggleSec} id="dash" title="대시보드">
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
            {[['today', '오늘의 수업'], ['progress', '반별 진도'], ['exam', '고사 D-day'], ['meal', '급식 · 날씨']].map(([k, labelText]) => (
              <SwitchRow key={k} label={labelText} on={cfg.dash[k]} onClick={() => setCfg({ dash: { ...cfg.dash, [k]: !cfg.dash[k] } })} />
            ))}
          </div>
        </Sec>

        <Sec open={open} toggleSec={toggleSec} id="print" title="인쇄">
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            {/* 범위를 먼저 고른다 — 고를 수 있는 크기가 범위에 따라 달라지므로 */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[[1, '이번 주', '한 주'], [2, '2주치', '다음 주까지']].map(([n, labelText, note]) => {
                const on = weeks === n
                return (
                  <button
                    key={n}
                    // 크기가 그 범위에 없으면(크게 + 2주치) 함께 내려 준다 — 저장본이 어긋나지 않게
                    onClick={() => setCfg({ printWeeks: n, printScale: fitScale(cfg.printScale || 'l', n) })}
                    style={{
                      flex: 1, border: '1px solid ' + (on ? GREEN : LINE), borderRadius: 8, cursor: 'pointer',
                      background: on ? GREEN : '#FFFFFF', color: on ? '#FFFFFF' : SUB,
                      padding: '9px 0', fontSize: 13, fontWeight: on ? 700 : 500,
                    }}
                  >
                    {labelText}
                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>{note}</div>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {printSizes(weeks).map(({ k, label: labelText, note }) => {
                const on = fitScale(cfg.printScale || 'l', weeks) === k
                return (
                  <button
                    key={k}
                    onClick={() => setCfg({ printScale: k })}
                    style={{
                      flex: 1, border: '1px solid ' + (on ? GREEN : LINE), borderRadius: 8, cursor: 'pointer',
                      background: on ? GREEN : '#FFFFFF', color: on ? '#FFFFFF' : SUB,
                      padding: '9px 0', fontSize: 13, fontWeight: on ? 700 : 500,
                    }}
                  >
                    {labelText}
                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>{note[weeks > 1 ? 2 : 1]}</div>
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 12, color: FAINT }}>
              {weeks > 1
                ? '보고 있는 주와 그 다음 주를 이어서 한 장에 뽑습니다. 한 주만으로 A4 한 장을 쓰는 「크게」는 두 장이 되어 고를 수 없습니다.'
                : '보고 있는 주만 뽑습니다.'}
            </div>
          </div>
        </Sec>

        <Sec open={open} toggleSec={toggleSec} id="school" title="우리 학교 · 급식 · 날씨">
          <SchoolWeatherSettings data={data} setData={setData} />
        </Sec>

        <Sec open={open} toggleSec={toggleSec} id="bells" title="교시 시각">
          <BellSettings data={data} setData={setData} />
        </Sec>

        <Sec open={open} toggleSec={toggleSec} id="install" title="앱으로 설치 · 바탕화면 위젯">
          <div style={{ padding: '0 0 16px', fontSize: 13, color: SUB, lineHeight: 1.65 }}>
            <div style={{ marginBottom: 12, padding: '10px 12px', background: '#F5F8FB', borderRadius: 10 }}>
              <b style={{ color: '#191F28' }}>위젯 (설치 없이)</b>
              <div>오른쪽 위 <b>[위젯]</b> 버튼을 누르면 오늘 수업·할 일·급식·날씨가 담긴 작은 창이 다른 창 위에 항상 떠 있습니다(크롬·엣지). 이 창(또는 설치한 앱 창)을 열어 둔 동안 떠 있습니다.</div>
              <b style={{ color: '#191F28', display: 'block', marginTop: 8 }}>바탕화면 위젯 (윈도우 프로그램)</b>
              <div>오늘 수업·지금 교시·할 일·D-day·급식·날씨를 바탕화면 작은 창에 띄웁니다.</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                <a href="https://github.com/soupplan-xam/jindo-manager/releases/latest" target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>설치 파일 받기</a>
                <a href={location.pathname + '#widget'} target="_blank" rel="noreferrer">브라우저에서 위젯 미리보기</a>
              </div>
              <div style={{ color: FAINT, fontSize: 12, marginTop: 4 }}>위젯 프로그램은 이 브라우저와 저장 공간이 따로라서, 처음 한 번 구름 아이콘으로 로그인하거나 JSON 파일을 불러와야 내용이 보입니다.</div>
            </div>
            {installed ? (
              <span>지금 설치한 앱으로 열려 있습니다.</span>
            ) : (
              <>
                {canInstall && (
                  <button onClick={install} style={{ border: 'none', borderRadius: 8, background: GREEN, color: '#FFFFFF', padding: '8px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
                    이 컴퓨터에 앱으로 설치
                  </button>
                )}
                <div>설치하면 바탕화면·작업표시줄 아이콘으로 따로 창이 열립니다. 내용은 브라우저와 같습니다.</div>
                <div style={{ color: FAINT, marginTop: 4 }}>
                  · 크롬·엣지: 주소창 오른쪽 설치 아이콘(⊕) 또는 메뉴 → [앱 설치]<br />
                  · 아이폰 사파리: 공유 → [홈 화면에 추가]<br />
                  · 안드로이드 크롬: 메뉴 → [홈 화면에 추가]
                </div>
              </>
            )}
          </div>
        </Sec>

        <Sec open={open} toggleSec={toggleSec} id="data" title="데이터">
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            <button onClick={() => exportJSON(data, today)} style={linkBtn}>전체 데이터 저장 (.json)</button>
            <button onClick={() => jsonRef.current.click()} style={linkBtn}>저장한 파일 불러오기 (.json)</button>
            {dataError && <div style={{ fontSize: 13, color: WARN }}>{dataError}</div>}
            <div style={{ fontSize: 12, color: FAINT }}>불러오면 현재 데이터를 대체합니다. API 키는 파일에 담기지 않습니다.</div>
            <button onClick={() => exportCSV(computed.sessions)} style={{ ...linkBtn, marginTop: 6 }}>진도 데이터 내보내기 (.csv)</button>
            {onSchools && <button onClick={onSchools} style={linkBtn}>학교 이름으로 학사일정 가져오기</button>}
            <button onClick={() => { onClose(); onResetSetup() }} style={linkBtn}>최초 설정 다시 하기</button>
            <button onClick={() => setConfirmClear(true)} style={{ ...linkBtn, color: RED, fontWeight: 700, marginTop: 4 }}>전체 내용 초기화</button>
            <input ref={jsonRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => loadFile(e.target.files[0])} />
          </div>
        </Sec>

        <Sec open={open} toggleSec={toggleSec} id="file" title="파일 인식">
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <input
                type={keyShown ? 'text' : 'password'}
                value={key}
                onChange={e => saveKey(e.target.value)}
                placeholder="sk-or-…"
                autoComplete="off"
                style={{ ...uInput, flex: 1, fontSize: 13, letterSpacing: '0.02em' }}
              />
              <button onClick={() => setKeyShown(!keyShown)} style={linkBtn}>{keyShown ? '가리기' : '표시'}</button>
              <button onClick={doCheck} style={linkBtn}>연결 확인</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13, color: SUB }}>
              <span>모델</span>
              <input
                value={model}
                onChange={e => { setModelState(e.target.value); setModel(e.target.value) }}
                style={{ ...uInput, flex: 1, fontSize: 13 }}
              />
            </div>
            {apiStatus && <div style={{ fontSize: 13, color: SUB }}>{apiStatus}</div>}
            <div style={{ fontSize: 12, color: FAINT }}>
              키는 이 브라우저에만 저장되며 파일 인식 요청에만 사용됩니다.{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">키 발급</a>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
              <button onClick={() => { onClose(); onImport('timetable') }} style={linkBtn}>시간표 파일 가져오기</button>
              <button onClick={() => { onClose(); onImport('schedule') }} style={linkBtn}>학사일정 파일 가져오기</button>
            </div>
          </div>
        </Sec>
        <div style={{ borderTop: '1px solid ' + LINE, paddingTop: 14, display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <a
            href={import.meta.env.BASE_URL + 'privacy.html'}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: GREEN, textDecoration: 'none' }}
          >
            개인정보처리방침
          </a>
          <span style={{ fontSize: 12, color: FAINT }}>입력한 내용은 이 브라우저에만 저장됩니다.</span>
        </div>
      </div>

      {confirmClear && (
        <Modal title="전체 내용 초기화" onClose={() => setConfirmClear(false)} width={400}>
          <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7 }}>
            시간표, 진도 기록, 일정, 차시별 내용이 모두 지워지고 최초 설정 화면으로 돌아갑니다.
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: FAINT, lineHeight: 1.7 }}>
            되돌릴 수 없습니다. 남겨둘 내용이 있다면 먼저 <b style={{ fontWeight: 600 }}>전체 데이터 저장(.json)</b>으로 백업하세요.
            API 키는 지워지지 않습니다.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, alignItems: 'center', marginTop: 22 }}>
            <button onClick={() => setConfirmClear(false)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 14, color: SUB }}>
              취소
            </button>
            <button
              onClick={() => {
                setConfirmClear(false)
                setData(defaultData())
                onClose()
                onResetSetup()
              }}
              style={{ border: 'none', borderRadius: 8, padding: '8px 18px', background: RED, color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              초기화
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  )
}

const uInput = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '4px 0' }
const uSelect = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 13, padding: '2px 0' }

// 설정 칸(펼치기) — 컴포넌트 밖에 두어야 값을 고칠 때마다 칸 안이 새로 만들어지지 않는다(입력 중 칸이 초기화되던 문제)
// 펼칠 수 있다는 걸 바로 알아채도록 화살표를 제목 옆에 붙이고 배경으로 강조한다.
function Sec({ id, title, children, open, toggleSec }) {
  return (
    <div style={{ borderTop: '1px solid ' + LINE }}>
      <button
        onClick={() => toggleSec(id)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, textAlign: 'left' }}
      >
        {title}
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 20, borderRadius: 5, flex: 'none',
            background: open[id] ? GREEN : '#E8EBEE',
            color: open[id] ? '#FFFFFF' : SUB,
            transition: 'background 150ms, color 150ms',
          }}
        >
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open[id] ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }}
          >
            <polyline points="5 9 12 16 19 9" />
          </svg>
        </span>
      </button>
      {open[id] && children}
    </div>
  )
}
