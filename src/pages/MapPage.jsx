import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Map, MapMarker, useKakaoLoader } from 'react-kakao-maps-sdk'
import toast from 'react-hot-toast'
import { mediaApi } from '../lib/api'
import './MapPage.css'

const SEOUL_CENTER = { lat: 37.5665, lng: 126.9780 }
const NEARBY_RADIUS = 0.001

function pickArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.content)) return data.content
  if (Array.isArray(data.items)) return data.items
  return []
}

function locationKey(loc, i) {
  return loc.id ?? `${loc.latitude},${loc.longitude},${i}`
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function MapPage() {
  const routerLocation = useLocation()
  const autoOpenedRef = useRef(false)

  const [kakaoLoading, kakaoError] = useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
  })

  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedLocation, setSelectedLocation] = useState(null)
  const [galleryItems, setGalleryItems] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)

  const [viewerIndex, setViewerIndex] = useState(null)

  // Locations 로딩
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await mediaApi.getLocations()
        if (!cancelled) setLocations(pickArray(data))
      } catch (error) {
        if (!cancelled) toast.error('위치 정보를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const closeGallery = useCallback(() => {
    setSelectedLocation(null)
    setGalleryItems([])
    setViewerIndex(null)
  }, [])

  const closeViewer = useCallback(() => setViewerIndex(null), [])

  const handleMarkerClick = useCallback(async (loc) => {
    setSelectedLocation(loc)
    setGalleryItems([])
    setGalleryLoading(true)
    try {
      const { data } = await mediaApi.getNearby(
        loc.latitude,
        loc.longitude,
        NEARBY_RADIUS,
        0,
        50,
      )
      setGalleryItems(pickArray(data))
    } catch (error) {
      toast.error('작품을 불러오지 못했습니다.')
    } finally {
      setGalleryLoading(false)
    }
  }, [])

  // Home 미리보기 지도 / 포트폴리오 카드에서 state로 위치를 넘겨받으면 갤러리 자동 오픈
  useEffect(() => {
    const auto = routerLocation.state?.autoOpen
    if (!auto || autoOpenedRef.current) return
    if (auto.latitude == null || auto.longitude == null) return
    autoOpenedRef.current = true
    handleMarkerClick(auto)
  }, [routerLocation.state, handleMarkerClick])

  const openViewer = (i) => setViewerIndex(i)

  const prevItem = useCallback(() => {
    setViewerIndex((i) => {
      if (i == null || galleryItems.length === 0) return i
      return (i - 1 + galleryItems.length) % galleryItems.length
    })
  }, [galleryItems.length])

  const nextItem = useCallback(() => {
    setViewerIndex((i) => {
      if (i == null || galleryItems.length === 0) return i
      return (i + 1) % galleryItems.length
    })
  }, [galleryItems.length])

  // ESC / 화살표 키 처리
  useEffect(() => {
    const onKey = (e) => {
      if (viewerIndex != null) {
        if (e.key === 'Escape') closeViewer()
        else if (e.key === 'ArrowLeft') prevItem()
        else if (e.key === 'ArrowRight') nextItem()
      } else if (selectedLocation) {
        if (e.key === 'Escape') closeGallery()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewerIndex, selectedLocation, closeViewer, prevItem, nextItem, closeGallery])

  const activeItem = viewerIndex != null ? galleryItems[viewerIndex] : null
  const locationDisplayName =
    selectedLocation?.locationName ||
    selectedLocation?.name ||
    (selectedLocation
      ? `${Number(selectedLocation.latitude).toFixed(4)}, ${Number(selectedLocation.longitude).toFixed(4)}`
      : '')

  return (
    <main className="map-page">
      {/* 지도 */}
      <div className="map-page__map">
        {kakaoError ? (
          <div className="map-page__status">카카오 지도를 불러오지 못했습니다.</div>
        ) : kakaoLoading ? (
          <div className="map-page__status">
            <div className="map-page__spinner" />
          </div>
        ) : (
          <Map
            center={SEOUL_CENTER}
            level={9}
            style={{ width: '100%', height: '100%' }}
          >
            {locations.map((loc, i) => (
              <MapMarker
                key={locationKey(loc, i)}
                position={{ lat: loc.latitude, lng: loc.longitude }}
                onClick={() => handleMarkerClick(loc)}
              />
            ))}
          </Map>
        )}
      </div>

      {/* 좌상단 오버레이: 타이틀 */}
      <div className="map-page__overlay map-page__overlay--title fade-in visible">
        <span className="section-label">MAP</span>
        <h1 className="map-page__title">촬영 위치</h1>
        <p className="map-page__desc">마커를 클릭하여 해당 위치의 작품을 확인하세요.</p>
      </div>

      {/* 우하단 오버레이: 카운트 */}
      {!loading && !kakaoLoading && (
        <div className="map-page__overlay map-page__overlay--count fade-in visible">
          <span className="map-page__count-num">{locations.length}</span>
          <span className="map-page__count-label">
            {locations.length > 0 ? '작품 위치' : '아직 촬영된 작품이 없습니다'}
          </span>
        </div>
      )}

      {/* 전체 로딩 */}
      {loading && !kakaoLoading && (
        <div className="map-page__loading">
          <div className="map-page__spinner" />
        </div>
      )}

      {/* 갤러리 모달 */}
      {selectedLocation && (
        <div
          className="gallery-modal"
          role="dialog"
          aria-modal="true"
          onClick={closeGallery}
        >
          <div className="gallery-modal__container" onClick={(e) => e.stopPropagation()}>
            <header className="gallery-modal__header">
              <div>
                <span className="section-label">LOCATION</span>
                <h2 className="gallery-modal__title">{locationDisplayName}</h2>
              </div>
              <button
                type="button"
                className="gallery-modal__close"
                onClick={closeGallery}
                aria-label="닫기"
              >
                ×
              </button>
            </header>

            {galleryLoading ? (
              <div className="gallery-modal__status">
                <div className="map-page__spinner" />
              </div>
            ) : galleryItems.length === 0 ? (
              <div className="gallery-modal__status">
                이 위치의 작품이 없습니다.
              </div>
            ) : (
              <div className="gallery-modal__grid">
                {galleryItems.map((item, i) => {
                  const isVideo = item.mediaType === 'VIDEO'
                  const imgThumb = item.thumbnailUrl || item.thumbnail || item.url || item.fileUrl
                  const videoSrc = item.fileUrl || item.url
                  const videoPoster = item.thumbnailUrl || item.thumbnail || undefined
                  const hasMedia = isVideo ? !!videoSrc : !!imgThumb
                  return (
                    <button
                      key={item.id ?? i}
                      type="button"
                      className="gallery-card"
                      onClick={() => openViewer(i)}
                    >
                      <div className="gallery-card__media">
                        {hasMedia ? (
                          isVideo ? (
                            <video
                              src={videoSrc}
                              poster={videoPoster}
                              muted
                              loop
                              autoPlay
                              playsInline
                              preload="auto"
                            />
                          ) : (
                            <img src={imgThumb} alt={item.locationName || ''} loading="lazy" />
                          )
                        ) : (
                          <div className="gallery-card__placeholder" />
                        )}
                        {isVideo && (
                          <span className="gallery-card__play" aria-hidden="true">▶</span>
                        )}
                      </div>
                      <div className="gallery-card__overlay">
                        <span className="gallery-card__category">
                          {isVideo ? 'VIDEO' : 'IMAGE'}
                        </span>
                        <span className="gallery-card__name">
                          {item.locationName || locationDisplayName}
                        </span>
                        {item.capturedAt && (
                          <span className="gallery-card__date">
                            {formatDate(item.capturedAt)}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 상세 뷰어 */}
      {activeItem && (
        <div
          className="viewer"
          role="dialog"
          aria-modal="true"
          onClick={closeViewer}
        >
          <button
            type="button"
            className="viewer__close"
            onClick={closeViewer}
            aria-label="닫기"
          >
            ×
          </button>

          {galleryItems.length > 1 && (
            <>
              <button
                type="button"
                className="viewer__nav viewer__nav--prev"
                onClick={(e) => { e.stopPropagation(); prevItem() }}
                aria-label="이전"
              >
                ‹
              </button>
              <button
                type="button"
                className="viewer__nav viewer__nav--next"
                onClick={(e) => { e.stopPropagation(); nextItem() }}
                aria-label="다음"
              >
                ›
              </button>
            </>
          )}

          <div className="viewer__content" onClick={(e) => e.stopPropagation()}>
            {activeItem.mediaType === 'VIDEO' ? (
              <video
                key={activeItem.id ?? viewerIndex}
                src={activeItem.url || activeItem.fileUrl}
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={activeItem.url || activeItem.fileUrl || activeItem.thumbnailUrl}
                alt={activeItem.locationName || ''}
              />
            )}
            <div className="viewer__meta">
              {activeItem.locationName && <span>{activeItem.locationName}</span>}
              {activeItem.capturedAt && <span>{formatDate(activeItem.capturedAt)}</span>}
              {galleryItems.length > 1 && (
                <span className="viewer__index">
                  {viewerIndex + 1} / {galleryItems.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
