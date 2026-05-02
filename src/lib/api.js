import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
})

// 요청 인터셉터: sessionStorage에 저장된 관리자 credentials 자동 주입
api.interceptors.request.use((config) => {
  const credentials = sessionStorage.getItem('admin_auth')
  if (credentials && !config.headers.Authorization) {
    config.headers.Authorization = `Basic ${credentials}`
  }
  return config
})

// API 함수들
// 페이지네이션/정렬 기본값:
//  - 작은 size로 인해 신규 영상이 다른 페이지로 밀려나는 현상 방지
//  - 백엔드가 sort 파라미터를 인식 못 해도 무시되므로 안전 (Spring 컨벤션)
const DEFAULT_LIST_PARAMS = { sort: 'uploadedAt,desc' }

export const mediaApi = {
  // 공개 API
  getLocations: () => api.get('/api/media/locations'),
  getAllMedia: (page = 0, size = 50) =>
    api.get('/api/media', { params: { ...DEFAULT_LIST_PARAMS, page, size } }),
  getNearby: (lat, lng, radius = 0.01, page = 0, size = 20) =>
    api.get('/api/media/nearby', {
      params: { ...DEFAULT_LIST_PARAMS, lat, lng, radius, page, size },
    }),
  getMedia: (id) => api.get(`/api/media/${id}`),

  // 관리자 API (Basic Auth 필요)
  verifyAuth: () => api.post('/api/auth/verify'),
  listAll: (page = 0, size = 200) =>
    api.get('/api/media', { params: { ...DEFAULT_LIST_PARAMS, page, size } }),
  createUploadUrl: (data) => api.post('/api/media/upload-url', data),
  completeUpload: (mediaId, data) => api.post(`/api/media/${mediaId}/complete`, data),
  deleteMedia: (id) => api.delete(`/api/media/${id}`),
  reorderMedia: (items) => api.put('/api/media/reorder', { items }),

  // Presigned URL에 직접 파일 업로드 (axios 기본 인스턴스 사용 안 함)
  uploadToPresignedUrl: (presignedUrl, file, onProgress) =>
    axios.put(presignedUrl, file, {
      headers: { 'Content-Type': file.type },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total))
        }
      }
    }),
}

export default api
