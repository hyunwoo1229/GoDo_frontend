import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Map, MapMarker, useKakaoLoader } from 'react-kakao-maps-sdk'
import { services } from '../data/portfolio'
import useInView from '../hooks/useInView'
import { useAllMedia, useMediaLocations } from '../hooks/useMediaList'
import './Home.css'

// ─────────────────────────────────────────────────────────────────
// Hero Section
// ─────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="hero">
      <div className="hero__bg" />
      <div className="hero__overlay" />

      <div className="hero__content container">
        <p className="hero__eyebrow">DRONE STUDIO · SINCE 2024</p>
        <h1 className="hero__title">
          하늘 위에서,<br />
          새로운 시각
        </h1>
        <p className="hero__subtitle">
          전문 드론 촬영으로 평범한 장면을<br />
          특별한 작품으로 만들어 드립니다.
        </p>
        <div className="hero__actions">
          <a href="#portfolio" className="btn btn--primary">작품 보기</a>
          <a href="#contact" className="btn btn--ghost">촬영 문의</a>
        </div>
      </div>

      <a href="#portfolio" className="hero__scroll" aria-label="아래로 스크롤">
        <span className="hero__scroll-label">SCROLL</span>
        <span className="hero__scroll-bar" />
      </a>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// Stats Section
// ─────────────────────────────────────────────────────────────────
const STATS = [
  { value: '10+', label: '완료 프로젝트' },
  { value: '2년',  label: '촬영 경력'    },
  { value: '4K·8K', label: '최고 화질'  },
  { value: '전국',  label: '출장 촬영'  },
]

function StatsSection() {
  const [ref, inView] = useInView()
  return (
    <section className="stats" ref={ref}>
      <div className="container">
        <div className="stats__grid">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`stats__item fade-in delay-${i + 1}${inView ? ' visible' : ''}`}
            >
              <span className="stats__value">{s.value}</span>
              <span className="stats__label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// Portfolio Section (백엔드 API 연동)
// ─────────────────────────────────────────────────────────────────
function PortfolioCard({ item }) {
  const isVideo = item.mediaType === 'VIDEO'
  const title = item.locationName || item.originalFileName || `작품 #${item.id}`
  const category = isVideo ? '영상' : '사진'

  // 시도할 소스 목록 — 앞에서부터 로드 시도, 실패 시 다음 소스로 자동 폴백
  //  - 영상: thumbnailUrl(이미지) → fileUrl(영상 첫 프레임) → placeholder
  //  - 이미지: fileUrl(원본) → placeholder (백엔드가 이미지 썸네일은 생성하지 않음)
  const sources = []
  if (isVideo && item.thumbnailUrl) {
    sources.push({ kind: 'img', url: item.thumbnailUrl })
  }
  if (item.fileUrl) {
    sources.push(
      isVideo
        ? { kind: 'video', url: `${item.fileUrl}#t=0.1` }
        : { kind: 'img', url: item.fileUrl },
    )
  }

  const [sourceIndex, setSourceIndex] = useState(0)
  const current = sources[sourceIndex]

  const handleError = (e) => {
    // 디버깅: 어떤 URL이 왜 실패했는지 콘솔에서 추적 가능
    console.warn('[PortfolioCard] media load failed', {
      id: item.id,
      mediaType: item.mediaType,
      tried: current?.url,
      nativeError: e?.target?.error,
    })
    if (sourceIndex < sources.length - 1) {
      setSourceIndex((i) => i + 1)
    } else {
      // 모든 소스 실패 → 인덱스를 끝까지 밀어 placeholder 노출
      setSourceIndex(sources.length)
    }
  }

  return (
    <Link
      to="/map"
      state={{
        autoOpen: {
          id: item.id,
          latitude: item.latitude,
          longitude: item.longitude,
          locationName: item.locationName,
          mediaType: item.mediaType,
        },
      }}
      className="pf-card pf-card--small"
    >
      <div className="pf-card__media">
        {current?.kind === 'img' && (
          <img
            key={current.url}
            src={current.url}
            alt={title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={handleError}
          />
        )}
        {current?.kind === 'video' && (
          <video
            key={current.url}
            src={current.url}
            muted
            playsInline
            preload="metadata"
            onError={handleError}
          />
        )}
        {!current && <div className="pf-card__placeholder" data-index={item.id} />}
        {isVideo && <span className="pf-card__play" aria-hidden="true">▶</span>}
      </div>
      <div className="pf-card__overlay">
        <span className="pf-card__category">{category}</span>
        <h3 className="pf-card__title">{title}</h3>
      </div>
    </Link>
  )
}

// locationName 별로 카드를 한 줄에 가로 스크롤로 보여주는 캐러셀
// - 모바일: 1장 표시
// - 데스크톱: 3장 표시
// - 네비게이션: 스와이프(브라우저 native) 또는 좌/우 화살표 버튼
function LocationCarousel({ locationName, items }) {
  const trackRef = useRef(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => {
      setCanPrev(el.scrollLeft > 1)
      setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [items.length])

  const scrollByCard = (dir) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector('.pf-row__item')
    const step = card ? card.clientWidth + 10 : el.clientWidth
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <div className="pf-row">
      <div className="pf-row__head">
        <h3 className="pf-row__title">{locationName}</h3>
        <div className="pf-row__nav">
          <button
            type="button"
            className="pf-row__btn"
            aria-label="이전"
            disabled={!canPrev}
            onClick={() => scrollByCard(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="pf-row__btn"
            aria-label="다음"
            disabled={!canNext}
            onClick={() => scrollByCard(1)}
          >
            ›
          </button>
        </div>
      </div>
      <div className="pf-row__track" ref={trackRef}>
        {items.map(item => (
          <div className="pf-row__item" key={item.id}>
            <PortfolioCard item={item} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PortfolioSection() {
  const [ref, inView] = useInView()
  const { data: items = [], isLoading: loading } = useAllMedia(0, 18)

  // locationName이 같은 항목끼리 그룹핑 (없으면 '기타'로 묶음).
  // 빌트인 Map 대신 일반 객체 사용 — 이 파일에서 import한 react-kakao-maps-sdk의
  // Map 컴포넌트가 전역 Map을 가려서 `new Map()`이 실패함.
  const groups = useMemo(() => {
    const grouped = {}
    const order = []
    for (const it of items) {
      const key = it.locationName?.trim() || '기타'
      if (!grouped[key]) {
        grouped[key] = []
        order.push(key)
      }
      grouped[key].push(it)
    }
    return order.map(key => ({ locationName: key, items: grouped[key] }))
  }, [items])

  return (
    <section id="portfolio" className="portfolio" ref={ref}>
      <div className="container">
        <div className={`section-head fade-in${inView ? ' visible' : ''}`}>
          <span className="section-label">WORKS</span>
          <h2 className="section-title">촬영 작품</h2>
          <p className="section-desc">
            독도, 울릉도, 한강, 갯벌 — 하늘에서만 볼 수 있는 시선
          </p>
        </div>

        {loading ? (
          <div className="portfolio__status">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="portfolio__empty">
            <p>아직 촬영된 작품이 없습니다.</p>
            <Link to="/admin/upload" className="btn btn--outline">
              관리자 업로드
            </Link>
          </div>
        ) : (
          <div className="portfolio__rows">
            {groups.map(group => (
              <LocationCarousel
                key={group.locationName}
                locationName={group.locationName}
                items={group.items}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// Map Preview Section
// ─────────────────────────────────────────────────────────────────
function MapPreviewSection() {
  const navigate = useNavigate()
  const [ref, inView] = useInView()
  const { data: locations = [] } = useMediaLocations()

  useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
  })

  return (
    <section id="map-preview" className="map-preview" ref={ref}>
      <div className="container">
        <div className={`section-head fade-in${inView ? ' visible' : ''}`}>
          <span className="section-label">MAP</span>
          <h2 className="section-title">촬영 위치</h2>
          <p className="section-desc">
            하늘에서 담은 순간들 — 위치로 찾아보세요
          </p>
        </div>

        <div className={`map-preview__wrap fade-in delay-1${inView ? ' visible' : ''}`}>
          <Map
            center={{ lat: 36.5, lng: 127.8 }}
            level={13}
            style={{ width: '100%', height: '100%' }}
          >
            {locations.map((loc, i) => (
              <MapMarker
                key={loc.id ?? `${loc.latitude},${loc.longitude},${i}`}
                position={{ lat: loc.latitude, lng: loc.longitude }}
                onClick={() =>
                  navigate('/map', {
                    state: {
                      autoOpen: {
                        id: loc.id,
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                        locationName: loc.locationName,
                        mediaType: loc.mediaType,
                      },
                    },
                  })
                }
              />
            ))}
          </Map>

          <Link to="/map" className="map-preview__fullscreen">
            전체화면 보기 →
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// Services Section
// ─────────────────────────────────────────────────────────────────
function ServicesSection() {
  const [ref, inView] = useInView()
  return (
    <section id="services" className="services" ref={ref}>
      <div className="container">
        <div className={`section-head fade-in${inView ? ' visible' : ''}`}>
          <span className="section-label">SERVICES</span>
          <h2 className="section-title">서비스</h2>
          <p className="section-desc">
            모든 촬영 환경에 맞춘 전문 솔루션을 제공합니다.
          </p>
        </div>

        <div className="services__grid">
          {services.map((svc, i) => (
            <div
              key={svc.id}
              className={`svc-card fade-in delay-${i + 1}${inView ? ' visible' : ''}`}
            >
              <span className="svc-card__num">{svc.num}</span>
              <h3 className="svc-card__title">{svc.title}</h3>
              <p className="svc-card__desc">{svc.description}</p>
              <span className="svc-card__arrow">→</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// About Section
// ─────────────────────────────────────────────────────────────────
function AboutSection() {
  const [ref, inView] = useInView()
  return (
    <section id="about" className="about" ref={ref}>
      <div className="container">
        <div className="about__inner">
          <div className={`about__text fade-in${inView ? ' visible' : ''}`}>
            <span className="section-label">STUDIO</span>
            <h2 className="section-title about__title">
              우리는 하늘 위에서<br />
              이야기를 담습니다
            </h2>
            <p>
              GoDo는 전문 드론 파일럿과 영상 전문가들로 구성된
              항공 촬영 스튜디오입니다. 최신 장비와 전문 기술로
              고객의 비전을 현실로 만들어 드립니다.
            </p>
            <p>
              부동산, 행사, 상업 광고, 자연 다큐멘터리 등 다양한
              분야에서 최고의 항공 촬영 서비스를 제공합니다.
            </p>
            <a href="#contact" className="btn btn--primary about__btn">
              스튜디오 더 알아보기
            </a>
          </div>

          <div className={`about__visual fade-in delay-2${inView ? ' visible' : ''}`}>
            <div className="about__img-wrap">
              <img
                src="/images/about/studio.jpg"
                alt="GoDo 스튜디오"
                loading="lazy"
                decoding="async"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            </div>
            <div className="about__badge">
              <span className="about__badge-num">10+</span>
              <span className="about__badge-text">성공 프로젝트</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// Contact Section
// ─────────────────────────────────────────────────────────────────
function ContactSection() {
  const [ref, inView] = useInView()
  return (
    <section id="contact" className="contact" ref={ref}>
      <div className="container">
        <div className={`contact__inner fade-in${inView ? ' visible' : ''}`}>
          <span className="section-label">CONTACT</span>
          <h2 className="contact__title">
            촬영 프로젝트를<br />시작해 보세요
          </h2>
          <p className="contact__sub">
            어떤 공간이든, 어떤 순간이든 — 하늘 위에서 담아드립니다.
          </p>
          <div className="contact__actions">
            <a href="mailto:godo_hover@naver.com" className="btn btn--primary btn--lg">
              이메일 문의하기
            </a>
            <a
              href="https://www.instagram.com/godo_hover/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--outline btn--lg"
            >
              인스타그램
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <span className="footer__logo">GoDo</span>
            <p>드론 촬영 스튜디오</p>
          </div>
          <nav className="footer__nav">
            <a href="#portfolio">작품</a>
            <a href="#services">서비스</a>
            <a href="#about">스튜디오</a>
            <a href="#contact">문의</a>
          </nav>
        </div>
        <div className="footer__bottom">
          <p>© {new Date().getFullYear()} GoDo. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <main>
      <HeroSection />
      <StatsSection />
      <PortfolioSection />
      <MapPreviewSection />
      <ServicesSection />
      <AboutSection />
      <ContactSection />
      <Footer />
    </main>
  )
}