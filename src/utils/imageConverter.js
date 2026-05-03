// 클라이언트 사이드 이미지 → WebP 변환
//
// 트레이드오프 메모:
//  - Canvas 변환은 EXIF 메타데이터(GPS, 카메라 정보 등)를 제거합니다.
//    GoDo는 위치를 지도 클릭으로 별도 입력받으므로 GPS 손실은 OK.
//  - EXIF Orientation은 모던 브라우저(Chromium 81+, Safari 13.1+, FF26+)가
//    이미지를 디코딩할 때 자동 적용해 그려주므로 회전은 자동 보존됩니다.
//  - 영상은 변환하지 않습니다(브라우저 환경에서 비실용적). 백엔드 비동기 변환에 위임.

const DEFAULT_QUALITY = 0.85
const MAX_DIMENSION = 4096 // 너무 큰 이미지는 다운스케일 (브라우저 캔버스 한계 회피)

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지 디코딩 실패'))
    }
    img.src = url
  })
}

function calcSize(width, height, max = MAX_DIMENSION) {
  if (width <= max && height <= max) return { width, height }
  const ratio = Math.min(max / width, max / height)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

function replaceExtension(filename, ext) {
  const dot = filename.lastIndexOf('.')
  return (dot > 0 ? filename.slice(0, dot) : filename) + ext
}

/**
 * File(이미지) → WebP File 변환
 * - 변환 실패 또는 결과가 더 커지면 원본 반환 (보장적 최선)
 */
export async function convertToWebP(file, quality = DEFAULT_QUALITY) {
  if (!file || !file.type?.startsWith('image/')) return file
  if (file.type === 'image/webp') return file

  let resourceUrl
  try {
    const { img, url } = await loadImage(file)
    resourceUrl = url

    const { width, height } = calcSize(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context 사용 불가')
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Blob 생성 실패'))),
        'image/webp',
        quality,
      )
    })

    // 변환 결과가 더 크면 원본 유지
    if (blob.size >= file.size) {
      console.log(
        `[WebP] ${file.name}: 변환 결과(${(blob.size / 1024).toFixed(1)}KB)가 더 커서 원본 유지`,
      )
      return file
    }

    const newName = replaceExtension(file.name, '.webp')
    const webpFile = new File([blob], newName, {
      type: 'image/webp',
      lastModified: Date.now(),
    })

    const ratio = ((1 - blob.size / file.size) * 100).toFixed(1)
    console.log(
      `[WebP] ${file.name} → ${newName}: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB (-${ratio}%)`,
    )

    return webpFile
  } catch (error) {
    console.warn(`[WebP] ${file?.name} 변환 실패, 원본 사용`, error)
    return file
  } finally {
    if (resourceUrl) URL.revokeObjectURL(resourceUrl)
  }
}

/**
 * 여러 파일을 순차 변환. 진행 상황 콜백으로 보고.
 * @param {File[]} files
 * @param {(done:number, total:number, currentFile:File) => void} onProgress
 * @param {number} quality
 * @returns {Promise<File[]>}
 */
export async function convertImagesToWebP(files, onProgress, quality = DEFAULT_QUALITY) {
  const result = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    onProgress?.(i, files.length, f)
    const out = f.type?.startsWith('image/') ? await convertToWebP(f, quality) : f
    result.push(out)
  }
  onProgress?.(files.length, files.length, null)
  return result
}
