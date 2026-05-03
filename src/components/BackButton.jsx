import { useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './BackButton.css'

// 직접 URL 진입(history 없음) 시 폴백 경로
export default function BackButton({ fallback = '/', label = '뒤로 가기' }) {
  const location = useLocation()
  const navigate = useNavigate()

  const goBack = useCallback(() => {
    // React Router는 첫 진입 시 location.key === 'default'로 표기됨
    if (location.key === 'default') {
      navigate(fallback, { replace: true })
    } else {
      navigate(-1)
    }
  }, [location.key, navigate, fallback])

  // ESC 키로 뒤로가기 (단, 다른 모달이 열려있으면 그쪽이 먼저 처리하도록 양보)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      // 모달이 열려있는 동안에는 모달 자체가 ESC를 처리하도록 스킵
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goBack])

  return (
    <button
      type="button"
      className="back-button"
      onClick={goBack}
      aria-label={label}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </button>
  )
}
