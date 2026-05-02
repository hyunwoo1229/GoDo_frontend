import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Map, MapMarker, useKakaoLoader } from 'react-kakao-maps-sdk'
import toast from 'react-hot-toast'
import { mediaApi } from '../lib/api'
import { authService } from '../lib/auth'
import './AdminUpload.css'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024        // 10MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024       // 500MB
const SEOUL_CENTER = { lat: 37.5665, lng: 126.9780 }

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function pickArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.content)) return data.content
  if (Array.isArray(data.items)) return data.items
  return []
}

function detectMediaType(file) {
  if (file.type.startsWith('image/')) return 'IMAGE'
  if (file.type.startsWith('video/')) return 'VIDEO'
  return null
}

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─────────────────────────────────────────────────────────────────
// 비밀번호 입력 모달
// ─────────────────────────────────────────────────────────────────
function AuthModal({ onSubmit }) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password) {
      toast.error('비밀번호를 입력하세요')
      return
    }
    setSubmitting(true)
    const ok = await onSubmit(password)
    setSubmitting(false)
    if (ok) setPassword('')
  }

  return (
    <div className="auth-modal" role="dialog" aria-modal="true">
      <div className="auth-modal__card">
        <span className="section-label">ADMIN</span>
        <h1 className="auth-modal__title">관리자 인증</h1>
        <p className="auth-modal__desc">
          업로드 기능을 사용하려면 비밀번호를 입력하세요.
        </p>

        <form className="auth-modal__form" onSubmit={handleSubmit} autoComplete="off">
          <div className="auth-modal__field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--lg auth-modal__submit"
            disabled={submitting}
          >
            {submitting ? '확인 중...' : '확인'}
          </button>
        </form>

        <Link to="/" className="auth-modal__back">← 홈으로 돌아가기</Link>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 업로드 페이지
// ─────────────────────────────────────────────────────────────────
export default function AdminUpload() {
  const [authenticated, setAuthenticated] = useState(authService.hasCredentials())

  const [kakaoLoading, kakaoError] = useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
  })

  // 업로드 섹션 state
  const [files, setFiles] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])
  const [fileStatuses, setFileStatuses] = useState([])
    // { status: 'pending'|'uploading'|'success'|'failed', progress, error }

  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)

  const [locationName, setLocationName] = useState('')
  const [capturedAt, setCapturedAt] = useState('')

  const [uploading, setUploading] = useState(false)

  // 관리 섹션 state
  const [mediaList, setMediaList] = useState([])
  const [managementLoading, setManagementLoading] = useState(false)
  const [orderDirty, setOrderDirty] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)

  // 파일 바뀔 때마다 미리보기 URL 생성/해제
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviewUrls(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  // 인증되면 관리 목록 로드
  useEffect(() => {
    if (authenticated) loadMediaList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated])

  // 영상은 백엔드 처리 시간이 길어 업로드 직후 listAll에 잡히지 않을 수 있음.
  // expectedIds가 주어지면 응답에 모두 포함될 때까지 짧게 재시도한다.
  const loadMediaList = async ({ expectedIds = [], silent = false } = {}) => {
    if (!silent) setManagementLoading(true)

    const fetchOnce = async () => {
      const { data } = await mediaApi.listAll()
      return pickArray(data)
    }

    try {
      let list = await fetchOnce()
      if (expectedIds.length > 0) {
        const has = (arr) => expectedIds.every((id) => arr.some((m) => m.id === id))
        const RETRY_DELAYS_MS = [800, 1500, 2500]
        for (const delay of RETRY_DELAYS_MS) {
          if (has(list)) break
          await new Promise((r) => setTimeout(r, delay))
          list = await fetchOnce()
        }
      }
      setMediaList(list)
      setOrderDirty(false)
    } catch (error) {
      if (error.response?.status === 401) {
        authService.clear()
        setAuthenticated(false)
      } else {
        toast.error('미디어 목록을 불러오지 못했습니다')
      }
    } finally {
      if (!silent) setManagementLoading(false)
    }
  }

  const handleAuth = async (password) => {
    authService.setPassword(password)
    try {
      await mediaApi.verifyAuth()
      setAuthenticated(true)
      toast.success('인증 완료')
      return true
    } catch (error) {
      authService.clear()
      if (error.response?.status === 401) {
        toast.error('비밀번호가 틀렸습니다')
      } else {
        toast.error('인증 중 오류가 발생했습니다')
      }
      return false
    }
  }

  const handleLogout = () => {
    authService.clear()
    setAuthenticated(false)
    setMediaList([])
    toast.success('로그아웃되었습니다')
  }

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0) return

    const accepted = []
    for (const f of picked) {
      const type = detectMediaType(f)
      if (!type) {
        toast.error(`${f.name}: 이미지/영상만 업로드 가능합니다`)
        continue
      }
      const maxSize = type === 'IMAGE' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
      if (f.size > maxSize) {
        toast.error(`${f.name}: 용량 초과 (${formatBytes(maxSize)})`)
        continue
      }
      accepted.push(f)
    }
    if (accepted.length === 0) return

    setFiles(accepted)
    setFileStatuses(accepted.map(() => ({ status: 'pending', progress: 0 })))
  }

  const removeFile = (i) => {
    if (uploading) return
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
    setFileStatuses((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleMapClick = (_target, mouseEvent) => {
    const lat = mouseEvent.latLng.getLat()
    const lng = mouseEvent.latLng.getLng()
    setLatitude(lat)
    setLongitude(lng)
  }

  const resetForm = () => {
    setFiles([])
    setFileStatuses([])
    setLatitude(null)
    setLongitude(null)
    setLocationName('')
    setCapturedAt('')
  }

  const canUpload =
    files.length > 0 && latitude != null && longitude != null && !uploading

  const updateFileStatus = (i, patch) => {
    setFileStatuses((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    )
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('파일을 선택하세요')
      return
    }
    if (latitude == null || longitude == null) {
      toast.error('지도에서 위치를 선택하세요')
      return
    }

    setUploading(true)

    let successCount = 0
    let failCount = 0
    let authFailed = false
    const newMediaIds = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const mediaType = detectMediaType(file)
      updateFileStatus(i, { status: 'uploading', progress: 0, error: null })

      try {
        const { data: uploadInfo } = await mediaApi.createUploadUrl({
          fileName: file.name,
          contentType: file.type,
          mediaType,
          fileSize: file.size,
        })

        await mediaApi.uploadToPresignedUrl(
          uploadInfo.presignedUrl,
          file,
          (p) => updateFileStatus(i, { progress: p }),
        )

        await mediaApi.completeUpload(uploadInfo.mediaId, {
          latitude,
          longitude,
          locationName: locationName || null,
          capturedAt: capturedAt || null,
        })

        updateFileStatus(i, { status: 'success', progress: 100 })
        successCount++
        if (uploadInfo.mediaId != null) newMediaIds.push(uploadInfo.mediaId)
      } catch (error) {
        if (error.response?.status === 401) {
          authFailed = true
          break
        }
        const msg =
          error.response?.data?.message || error.message || '알 수 없는 오류'
        updateFileStatus(i, { status: 'failed', progress: 0, error: msg })
        failCount++
      }
    }

    setUploading(false)

    if (authFailed) {
      authService.clear()
      setAuthenticated(false)
      toast.error('인증이 만료되었습니다. 다시 로그인해주세요.')
      return
    }

    if (failCount === 0) {
      toast.success(`${successCount}개 파일 업로드 완료!`)
      resetForm()
    } else {
      toast.error(`${successCount}개 성공, ${failCount}개 실패`)
    }

    // 새 미디어 id가 목록에 반영될 때까지 짧게 재시도
    loadMediaList({ expectedIds: newMediaIds })
  }

  // ── 관리 섹션 핸들러 ─────────────────────────────────────────
  const moveUp = (i) => {
    if (i === 0) return
    setMediaList((prev) => {
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
    setOrderDirty(true)
  }

  const moveDown = (i) => {
    setMediaList((prev) => {
      if (i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
    setOrderDirty(true)
  }

  const handleDelete = async (item) => {
    const label = item.locationName || item.originalFileName || `#${item.id}`
    if (!window.confirm(`정말 "${label}"을(를) 삭제하시겠습니까?`)) return
    try {
      await mediaApi.deleteMedia(item.id)
      setMediaList((prev) => prev.filter((m) => m.id !== item.id))
      toast.success('삭제되었습니다')
    } catch (error) {
      if (error.response?.status === 401) {
        authService.clear()
        setAuthenticated(false)
      } else {
        toast.error('삭제 실패')
      }
    }
  }

  const saveOrder = async () => {
    if (!orderDirty || savingOrder) return
    setSavingOrder(true)
    try {
      const items = mediaList.map((m, idx) => ({ id: m.id, displayOrder: idx }))
      await mediaApi.reorderMedia(items)
      setOrderDirty(false)
      toast.success('순서가 저장되었습니다')
    } catch (error) {
      if (error.response?.status === 401) {
        authService.clear()
        setAuthenticated(false)
      } else {
        toast.error('순서 저장 실패')
      }
    } finally {
      setSavingOrder(false)
    }
  }

  const markerPosition = useMemo(() => {
    if (latitude == null || longitude == null) return null
    return { lat: latitude, lng: longitude }
  }, [latitude, longitude])

  // 인증 전이면 모달만 렌더
  if (!authenticated) {
    return (
      <main className="admin-upload">
        <div className="admin-upload__bg" />
        <AuthModal onSubmit={handleAuth} />
      </main>
    )
  }

  return (
    <main className="admin-upload">
      <div className="admin-upload__bg" />

      <div className="admin-upload__inner">
        <header className="admin-upload__header">
          <div>
            <span className="section-label">ADMIN</span>
            <h1 className="admin-upload__title">미디어 관리</h1>
            <p className="admin-upload__user">세션이 종료되면 자동으로 로그아웃됩니다.</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn--outline admin-upload__logout"
          >
            로그아웃
          </button>
        </header>

        {/* ═══════════════ UPLOAD SECTION ═══════════════ */}
        <section className="admin-upload__section">
          <div className="admin-upload__section-head">
            <span className="section-label">UPLOAD</span>
            <h2 className="admin-upload__section-title">새 작품 업로드</h2>
          </div>

          <div className="admin-upload__grid">
            {/* LEFT: 파일 선택 + 리스트 */}
            <div className="admin-upload__col">
              <div className="admin-upload__block">
                <span className="admin-upload__block-label">01 / FILES</span>
                <h3 className="admin-upload__block-title">파일 선택</h3>

                <label className="admin-upload__file">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                  <span className="admin-upload__file-btn">
                    {files.length > 0 ? `파일 다시 선택 (${files.length}개)` : '파일 선택하기'}
                  </span>
                  <span className="admin-upload__file-hint">
                    여러 파일 선택 가능 · 이미지 최대 10MB · 영상 최대 500MB
                  </span>
                </label>

                {files.length > 0 && (
                  <ul className="admin-upload__file-list">
                    {files.map((f, i) => {
                      const status = fileStatuses[i]?.status ?? 'pending'
                      const progress = fileStatuses[i]?.progress ?? 0
                      const error = fileStatuses[i]?.error
                      const type = detectMediaType(f)
                      const isVideo = type === 'VIDEO'
                      return (
                        <li
                          key={`${f.name}-${f.size}-${i}`}
                          className={`admin-upload__file-item admin-upload__file-item--${status}`}
                        >
                          <div className="admin-upload__file-item-thumb">
                            {previewUrls[i] && (
                              isVideo ? (
                                <video
                                  src={`${previewUrls[i]}#t=0.1`}
                                  muted
                                  loop
                                  autoPlay
                                  playsInline
                                  preload="auto"
                                />
                              ) : (
                                <img src={previewUrls[i]} alt="" />
                              )
                            )}
                            {isVideo && (
                              <span className="admin-upload__file-item-badge">▶</span>
                            )}
                          </div>
                          <div className="admin-upload__file-item-info">
                            <span className="admin-upload__file-item-name" title={f.name}>
                              {f.name}
                            </span>
                            <span className="admin-upload__file-item-meta">
                              {type} · {formatBytes(f.size)}
                              {status === 'uploading' && ` · 업로드 중 ${progress}%`}
                              {status === 'success' && ' · 완료'}
                              {status === 'failed' && ` · 실패${error ? `: ${error}` : ''}`}
                              {status === 'pending' && ' · 대기'}
                            </span>
                            {status === 'uploading' && (
                              <div className="admin-upload__progress-bar">
                                <div
                                  className="admin-upload__progress-fill"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                          {!uploading && status !== 'success' && (
                            <button
                              type="button"
                              className="admin-upload__file-item-remove"
                              onClick={() => removeFile(i)}
                              aria-label="제거"
                            >
                              ×
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* RIGHT: 지도 + 메타 */}
            <div className="admin-upload__col">
              <div className="admin-upload__block">
                <span className="admin-upload__block-label">02 / LOCATION</span>
                <h3 className="admin-upload__block-title">촬영 위치 선택</h3>
                <p className="admin-upload__hint">지도에서 촬영 지점을 클릭하세요. 모든 파일에 공통 적용됩니다.</p>

                <div className="admin-upload__map">
                  {kakaoError ? (
                    <div className="admin-upload__map-error">카카오 지도를 불러오지 못했습니다.</div>
                  ) : kakaoLoading ? (
                    <div className="admin-upload__map-loading">지도를 불러오는 중...</div>
                  ) : (
                    <Map
                      center={SEOUL_CENTER}
                      level={7}
                      style={{ width: '100%', height: '100%' }}
                      onClick={handleMapClick}
                    >
                      {markerPosition && <MapMarker position={markerPosition} />}
                    </Map>
                  )}
                </div>

                <div className="admin-upload__coords">
                  {markerPosition ? (
                    <>
                      <span>위도 <strong>{latitude.toFixed(6)}</strong></span>
                      <span>경도 <strong>{longitude.toFixed(6)}</strong></span>
                    </>
                  ) : (
                    <span className="admin-upload__coords-empty">위치가 선택되지 않았습니다.</span>
                  )}
                </div>
              </div>

              <div className="admin-upload__block">
                <span className="admin-upload__block-label">03 / DETAILS</span>
                <h3 className="admin-upload__block-title">부가 정보</h3>

                <div className="admin-upload__field">
                  <label htmlFor="locationName">장소명 (선택)</label>
                  <input
                    id="locationName"
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="예: 한강공원 뚝섬지구"
                    disabled={uploading}
                  />
                </div>

                <div className="admin-upload__field">
                  <label htmlFor="capturedAt">촬영 일시 (선택)</label>
                  <input
                    id="capturedAt"
                    type="datetime-local"
                    value={capturedAt}
                    onChange={(e) => setCapturedAt(e.target.value)}
                    disabled={uploading}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="admin-upload__actions">
            <button
              type="button"
              className="btn btn--primary btn--lg admin-upload__submit"
              onClick={handleUpload}
              disabled={!canUpload}
            >
              {uploading ? '업로드 중...' : `업로드${files.length > 0 ? ` (${files.length}개)` : ''}`}
            </button>
          </div>
        </section>

        {/* ═══════════════ MANAGEMENT SECTION ═══════════════ */}
        <section className="admin-upload__section">
          <div className="admin-upload__section-head">
            <div>
              <span className="section-label">MANAGE</span>
              <h2 className="admin-upload__section-title">등록된 작품</h2>
            </div>
            <div className="admin-upload__manage-actions">
              <button
                type="button"
                onClick={() => loadMediaList()}
                className="btn btn--outline"
                disabled={managementLoading}
              >
                새로고침
              </button>
              <button
                type="button"
                onClick={saveOrder}
                className="btn btn--primary"
                disabled={!orderDirty || savingOrder}
              >
                {savingOrder ? '저장 중...' : '순서 저장'}
              </button>
            </div>
          </div>

          {managementLoading ? (
            <div className="admin-upload__manage-status">불러오는 중...</div>
          ) : mediaList.length === 0 ? (
            <div className="admin-upload__manage-status">등록된 작품이 없습니다.</div>
          ) : (
            <ul className="admin-upload__media-list">
              {mediaList.map((item, i) => {
                const isVideo = item.mediaType === 'VIDEO'
                // 영상은 fileUrl을 src로, thumbnailUrl이 있으면 poster로 사용
                const imgSrc = item.thumbnailUrl || item.fileUrl
                const videoSrc = item.fileUrl
                const videoPoster = item.thumbnailUrl || undefined
                const hasMedia = isVideo ? !!videoSrc : !!imgSrc
                return (
                  <li key={item.id} className="admin-upload__media-item">
                    <div className="admin-upload__media-thumb">
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
                          <img src={imgSrc} alt="" loading="lazy" />
                        )
                      ) : (
                        <div className="admin-upload__media-thumb-placeholder" />
                      )}
                      {isVideo && (
                        <span className="admin-upload__media-badge">▶</span>
                      )}
                    </div>
                    <div className="admin-upload__media-info">
                      <span className="admin-upload__media-name">
                        {item.locationName || item.originalFileName || `#${item.id}`}
                      </span>
                      <span className="admin-upload__media-meta">
                        {formatDateTime(item.uploadedAt)}
                        {typeof item.latitude === 'number' && typeof item.longitude === 'number' && (
                          <> · {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</>
                        )}
                      </span>
                    </div>
                    <div className="admin-upload__media-actions">
                      <button
                        type="button"
                        onClick={() => moveUp(i)}
                        disabled={i === 0}
                        aria-label="위로"
                        className="admin-upload__icon-btn"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => moveDown(i)}
                        disabled={i === mediaList.length - 1}
                        aria-label="아래로"
                        className="admin-upload__icon-btn"
                      >↓</button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="admin-upload__icon-btn admin-upload__icon-btn--danger"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
