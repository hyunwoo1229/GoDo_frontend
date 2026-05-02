// Basic Auth 관리 — username은 항상 "admin" 고정, 비밀번호만 관리
// sessionStorage를 사용하므로 탭 종료 시 자동 로그아웃됨
export const authService = {
  setPassword: (password) => {
    const credentials = btoa(`admin:${password}`)
    sessionStorage.setItem('admin_auth', credentials)
  },

  getCredentials: () => sessionStorage.getItem('admin_auth'),

  clear: () => {
    sessionStorage.removeItem('admin_auth')
  },

  hasCredentials: () => !!sessionStorage.getItem('admin_auth'),
}
