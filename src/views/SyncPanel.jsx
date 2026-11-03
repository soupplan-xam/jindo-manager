import React, { useState } from 'react'
import Modal from './Modal.jsx'
import { GREEN, INK, SUB, FAINT, LINE, WARN, RED } from '../logic.js'
import { signIn, signOutUser } from '../sync.js'

const STATUS = {
  loading: { t: '확인 중', c: FAINT },
  out: { t: '로그인하면 휴대폰과 맞춰집니다', c: FAINT },
  connecting: { t: '연결 중', c: FAINT },
  saving: { t: '저장 중', c: WARN },
  saved: { t: '모든 기기에 저장됨', c: GREEN },
  offline: { t: '오프라인 — 연결되면 올립니다', c: WARN },
  conflict: { t: '어느 내용을 쓸지 골라주세요', c: RED },
  error: { t: '저장하지 못했습니다', c: RED },
}

export function SyncButton({ sync, onClick, compact }) {
  if (!sync.available) return null
  const st = STATUS[sync.status] || STATUS.loading
  const on = !!sync.user
  return (
    <button
      onClick={onClick}
      title={on ? '기기 연동: ' + st.t : '구글 로그인으로 휴대폰과 연동'}
      aria-label={on ? '기기 연동 상태: ' + st.t : '기기 연동 로그인'}
      className="hov"
      style={{
        border: 'none', background: 'none', borderRadius: 6, padding: '5px 6px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5, color: on ? SUB : FAINT, flex: 'none', position: 'relative', fontSize: 12.5, fontWeight: 600,
      }}
    >
      <CloudIcon />
      {!on && !compact && <span>연동</span>}
      {on && (
        <span style={{ position: 'absolute', right: 3, bottom: 4, width: 7, height: 7, borderRadius: '50%', background: st.c, border: '1.5px solid #FCFCFA' }} />
      )}
    </button>
  )
}

export function SyncModal({ sync, onClose }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const st = STATUS[sync.status] || STATUS.loading
  const login = async () => {
    setErr('')
    setBusy(true)
    try {
      await signIn()
    } catch (e) {
      setErr(e && e.code === 'auth/unauthorized-domain'
        ? '이 주소가 Firebase 로그인 허용 도메인에 없습니다. Firebase 콘솔 > Authentication > 설정 > 승인된 도메인에 추가해주세요.'
        : '로그인하지 못했습니다. ' + ((e && e.code) || ''))
    }
    setBusy(false)
  }
  return (
    <Modal title="기기 연동" onClose={onClose} width={440}>
      {!sync.user ? (
        <div style={{ marginTop: 14, fontSize: 14, color: INK, lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>구글 계정으로 로그인하면 컴퓨터와 휴대폰에서 같은 진도표를 봅니다. 한 기기에서 고치면 다른 기기에도 바로 반영됩니다.</p>
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: FAINT }}>로그인하지 않아도 지금처럼 이 브라우저에만 저장해서 쓸 수 있습니다. 파일 인식용 API 키는 올리지 않습니다.</p>
          <button
            onClick={login}
            disabled={busy}
            style={{
              marginTop: 16, width: '100%', border: '1px solid ' + LINE, background: '#FFFFFF', borderRadius: 6,
              padding: '10px 12px', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', color: INK,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <GoogleMark /> {busy ? '로그인 창을 여는 중…' : '구글 계정으로 로그인'}
          </button>
          {err && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: RED }}>{err}</div>}
        </div>
      ) : (
        <div style={{ marginTop: 14, fontSize: 14, color: INK }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.c, flex: 'none' }} />
            <span style={{ fontWeight: 700 }}>{st.t}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5, color: SUB }}>{sync.user.email}</div>
          {sync.lastSaved && <div style={{ marginTop: 2, fontSize: 12, color: FAINT }}>마지막 동기화 {new Date(sync.lastSaved).toLocaleString('ko-KR')}</div>}
          <p style={{ margin: '14px 0 0', fontSize: 12.5, color: FAINT, lineHeight: 1.6 }}>
            휴대폰에서 이 주소를 열고 같은 구글 계정으로 로그인하면 됩니다. 화면 배치(나눔 비율 등)는 기기마다 따로 둡니다.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              onClick={() => signOutUser().then(onClose)}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: SUB }}
            >
              로그아웃 (이 기기 내용은 그대로 남습니다)
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// 처음 연결할 때 양쪽이 모두 바뀌었으면 고르게 한다
export function SyncConflictModal({ sync, data }) {
  if (!sync.conflict) return null
  let remote = null
  try { remote = JSON.parse(sync.conflict.remote.json) } catch { /* 깨진 문서 */ }
  const sum = d => d
    ? (d.classes || []).length + '개 반 · 일정 ' + (d.events || []).length + '건 · 결손/수행 ' + Object.keys(d.cancels || {}).length + '건'
    : '읽을 수 없음'
  const when = sync.conflict.remote.updatedAt ? new Date(sync.conflict.remote.updatedAt).toLocaleString('ko-KR') : ''
  const choice = (label, sub, onClick, primary) => (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', width: '100%', border: '1px solid ' + (primary ? GREEN : LINE), background: primary ? '#EAF1EE' : '#FFFFFF',
        borderRadius: 6, padding: '11px 13px', cursor: 'pointer', color: INK,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 12, color: SUB, marginTop: 3 }}>{sub}</div>
    </button>
  )
  return (
    <Modal title="어느 내용을 쓸까요?" onClose={() => {}} width={460} noClose>
      <p style={{ margin: '12px 0 14px', fontSize: 13.5, color: SUB, lineHeight: 1.6 }}>
        이 기기와 온라인에 서로 다른 내용이 있습니다. 고른 쪽으로 양쪽을 맞춥니다. 덮어쓰는 이 기기 내용은 한 벌 따로 보관해 둡니다.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {choice('온라인 내용 쓰기', (when ? when + ' 저장 · ' : '') + sum(remote), () => sync.resolve('remote'), true)}
        {choice('이 기기 내용 쓰기', '지금 화면 · ' + sum(data), () => sync.resolve('local'), false)}
      </div>
    </Modal>
  )
}

function CloudIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.5 19H7a5 5 0 1 1 1.1-9.88A6 6 0 0 1 19.6 11 4 4 0 0 1 17.5 19z" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
