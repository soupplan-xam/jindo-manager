import React from 'react'
import { GREEN, INK, SUB, FAINT, LINE } from '../logic.js'
import Modal from './Modal.jsx'

// 처음 시작할 때 한 번 — 학사일정을 손으로 넣지 않아도 된다는 것을 먼저 알려준다.
// 일정을 넣었거나 한 번 닫으면 다시 뜨지 않는다 (data.schedIntroSeen).
export default function ScheduleGuideModal({ onSearch, onClose }) {
  return (
    <Modal title="학사일정부터 넣고 시작하세요" onClose={onClose} width={460}>
      <div style={{ marginTop: 8, fontSize: 13.5, color: SUB, lineHeight: 1.65 }}>
        우리 학교 이름만 검색하면 나이스에 등록된 학사일정을 그대로 가져옵니다.
        하나씩 입력하지 않아도 됩니다.
      </div>

      <div style={{ marginTop: 16, border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', padding: '4px 14px' }}>
        {[
          ['학교 이름 검색', '전국 초·중·고'],
          ['넣을 일정 고르기', '휴업일·고사는 미리 골라 둡니다'],
          ['넣기', '이어지는 날은 한 건으로 묶입니다'],
        ].map(([title, desc], i) => (
          <div
            key={title}
            style={{
              display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 0',
              borderTop: i ? '1px solid #F2F4F6' : 'none',
            }}
          >
            <span
              style={{
                width: 18, height: 18, borderRadius: '50%', background: GREEN, color: '#FFFFFF',
                fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flex: 'none', alignSelf: 'center',
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK, flex: 'none' }}>{title}</span>
            <span style={{ fontSize: 12, color: FAINT, minWidth: 0 }}>{desc}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: FAINT, lineHeight: 1.6 }}>
        휴업일·고사를 넣으면 그 날 수업이 자동으로 빠지고 뒤 차시가 밀립니다.
        나중에 일정 화면의 [학교검색]에서도 언제든 부를 수 있습니다.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13.5, color: SUB, flex: 'none' }}>
          나중에
        </button>
        <button
          onClick={onSearch}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 8,
            padding: '9px 18px', background: GREEN, color: '#FFFFFF',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', flex: 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          학교 검색하기
        </button>
      </div>
    </Modal>
  )
}
