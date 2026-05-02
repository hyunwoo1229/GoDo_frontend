import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authService } from '../lib/auth'
import './Navbar.css'

const SECTION_LINKS = [
  { label: '작품', hash: '#portfolio' },
  { label: '서비스', hash: '#services' },
  { label: '스튜디오', hash: '#about' },
  { label: '문의', hash: '#contact' },
]

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(authService.hasCredentials())

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // 경로가 바뀔 때마다 로그인 상태 재평가 + 해시가 있으면 해당 섹션으로 스크롤
  useEffect(() => {
    setIsLoggedIn(authService.hasCredentials())

    if (location.pathname === '/' && location.hash) {
      const el = document.querySelector(location.hash)
      if (el) {
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth' }))
      }
    }
  }, [location])

  const close = () => setMenuOpen(false)

  const handleSectionClick = (e, hash) => {
    e.preventDefault()
    close()
    if (location.pathname === '/') {
      const el = document.querySelector(hash)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/' + hash)
    }
  }

  const handleLogout = () => {
    authService.clear()
    setIsLoggedIn(false)
    close()
    navigate('/')
  }

  return (
    <>
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
        <div className="navbar__inner">
          <Link to="/" className="navbar__logo" onClick={close}>
            GO<span>DO</span>
          </Link>

          <ul className="navbar__links">
            {SECTION_LINKS.map(({ label, hash }) => (
              <li key={label}>
                <a href={hash} onClick={(e) => handleSectionClick(e, hash)}>{label}</a>
              </li>
            ))}
            <li>
              <Link to="/map">지도</Link>
            </li>
            <li>
              <Link to="/admin/upload">업로드</Link>
            </li>
            {isLoggedIn && (
              <li>
                <a href="#logout" onClick={(e) => { e.preventDefault(); handleLogout() }}>
                  로그아웃
                </a>
              </li>
            )}
          </ul>

          <a
            href="#contact"
            className="navbar__cta"
            onClick={(e) => handleSectionClick(e, '#contact')}
          >
            촬영 문의
          </a>

          <button
            className={`navbar__toggle${menuOpen ? ' navbar__toggle--open' : ''}`}
            onClick={() => setMenuOpen(v => !v)}
            aria-label="메뉴 열기/닫기"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile full-screen menu */}
      <div className={`navbar__mobile${menuOpen ? ' navbar__mobile--open' : ''}`}>
        <ul>
          {SECTION_LINKS.map(({ label, hash }, i) => (
            <li key={label} style={{ transitionDelay: menuOpen ? `${i * 0.06}s` : '0s' }}>
              <a href={hash} onClick={(e) => handleSectionClick(e, hash)}>{label}</a>
            </li>
          ))}
          <li style={{ transitionDelay: menuOpen ? `${SECTION_LINKS.length * 0.06}s` : '0s' }}>
            <Link to="/map" onClick={close}>지도</Link>
          </li>
          <li style={{ transitionDelay: menuOpen ? `${(SECTION_LINKS.length + 1) * 0.06}s` : '0s' }}>
            <Link to="/admin/upload" onClick={close}>업로드</Link>
          </li>
          {isLoggedIn && (
            <li style={{ transitionDelay: menuOpen ? `${(SECTION_LINKS.length + 2) * 0.06}s` : '0s' }}>
              <a href="#logout" onClick={(e) => { e.preventDefault(); handleLogout() }}>
                로그아웃
              </a>
            </li>
          )}
          <li style={{ transitionDelay: menuOpen ? `${(SECTION_LINKS.length + (isLoggedIn ? 3 : 2)) * 0.06}s` : '0s' }}>
            <a
              href="#contact"
              className="navbar__mobile-cta"
              onClick={(e) => handleSectionClick(e, '#contact')}
            >
              촬영 문의
            </a>
          </li>
        </ul>
      </div>
    </>
  )
}
