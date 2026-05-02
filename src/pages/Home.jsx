import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Map, MapMarker, useKakaoLoader } from 'react-kakao-maps-sdk'
import { services } from '../data/portfolio'
import useInView from '../hooks/useInView'
import { mediaApi } from '../lib/api'
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
        <p className="hero__eyebrow">DRONE STUDIO · SINCE 2020</p>
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
  { value: '200+', label: '완료 프로젝트' },
  { value: '5년',  label: '촬영 경력'    },
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
function pickArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.content)) return data.content
  if (Array.isArray(data.items)) return data.items
  return []
}

function PortfolioCard({ item }) {
  const [mediaError, setMediaError] = useState(false)
  const isVideo = item.mediaType === 'VIDEO'
  const title = item.locationName || item.originalFileName || `작품 #${item.id}`
  const category = isVideo ? '영상' : '사진'
  // 영상은 반드시 fileUrl(실제 영상)을 src로 사용. thumbnailUrl은 poster(이미지 미리보기)로.
  // 이미지는 thumbnailUrl이 있으면 그것을, 없으면 fileUrl 사용.
  const videoSrc = item.fileUrl
  const videoPoster = item.thumbnailUrl || undefined
  const imageSrc = item.thumbnailUrl || item.fileUrl
  const hasMedia = isVideo ? !!videoSrc : !!imageSrc

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
        {!mediaError && hasMedia ? (
          isVideo ? (
            <video
              src={videoSrc}
              poster={videoPoster}
              muted
              loop
              autoPlay
              playsInline
              preload="auto"
              onError={() => setMediaError(true)}
            />
          ) : (
            <img
              src={imageSrc}
              alt={title}
              loading="lazy"
              decoding="async"
              onError={() => setMediaError(true)}
            />
          )
        ) : (
          <div className="pf-card__placeholder" data-index={item.id} />
        )}
        {isVideo && <span className="pf-card__play" aria-hidden="true">▶</span>}
      </div>
      <div className="pf-card__overlay">
        <span className="pf-card__category">{category}</span>
        <h3 className="pf-card__title">{title}</h3>
      </div>
    </Link>
  )
}

function PortfolioSection() {
  const [ref, inView] = useInView()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await mediaApi.getAllMedia(0, 18)
        if (!cancelled) setItems(pickArray(data))
      } catch (error) {
        console.error('포트폴리오 로딩 실패', error)
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

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
          <div className="portfolio__grid">
            {items.map(item => (
              <PortfolioCard key={item.id} item={item} />
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
  const [locations, setLocations] = useState([])

  useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
  })

  useEffect(() => {
    let cancelled = false
    mediaApi.getLocations()
      .then(res => {
        if (cancelled) return
        const data = res.data
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.content) ? data.content
          : Array.isArray(data?.items) ? data.items
          : []
        setLocations(arr)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
            style={{ width: '100%', height: '500px' }}
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
              GODO는 전문 드론 파일럿과 영상 전문가들로 구성된
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
                alt="GODO 스튜디오"
                loading="lazy"
                decoding="async"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            </div>
            <div className="about__badge">
              <span className="about__badge-num">200+</span>
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
            <a href="mailto:hello@godo.kr" className="btn btn--primary btn--lg">
              이메일 문의하기
            </a>
            <a href="tel:010-0000-0000" className="btn btn--outline btn--lg">
              010 · 0000 · 0000
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
            <span className="footer__logo">GODO</span>
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
          <p>© {new Date().getFullYear()} GODO. All rights reserved.</p>
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