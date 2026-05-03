import { useQuery } from '@tanstack/react-query'
import { mediaApi } from '../lib/api'

function pickArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.content)) return data.content
  if (Array.isArray(data.items)) return data.items
  return []
}

const FIVE_MIN = 5 * 60 * 1000

// 지도용 — 모든 위치 마커 데이터 (LocationDto 배열)
export function useMediaLocations() {
  return useQuery({
    queryKey: ['media', 'locations'],
    queryFn: async () => {
      const { data } = await mediaApi.getLocations()
      return pickArray(data)
    },
    staleTime: FIVE_MIN,
  })
}

// 갤러리용 — 특정 좌표 주변 미디어 목록
export function useMediaByLocation(lat, lng, radius = 0.001) {
  return useQuery({
    queryKey: ['media', 'nearby', lat, lng, radius],
    queryFn: async () => {
      const { data } = await mediaApi.getNearby(lat, lng, radius, 0, 50)
      return pickArray(data)
    },
    enabled: lat != null && lng != null,
    staleTime: FIVE_MIN,
  })
}

// 홈 포트폴리오용 — 페이지네이션 가능한 전체 미디어
export function useAllMedia(page = 0, size = 18) {
  return useQuery({
    queryKey: ['media', 'all', page, size],
    queryFn: async () => {
      const { data } = await mediaApi.getAllMedia(page, size)
      return pickArray(data)
    },
    staleTime: FIVE_MIN,
  })
}
