import type { HienThi } from '../../preload/api-types'

/** Áp thiết lập Hiển thị lên `<html>` ngay lập tức — không remount, không mất vị trí cuộn/ô đang gõ
 *. Gọi trước khi vẽ màn đầu để tránh chớp sáng/tối. */
export function apDungHienThi(h: HienThi): void {
  const root = document.documentElement
  root.style.setProperty('--scale', String(h.scale))
  root.style.setProperty('--row-h', `${h.rowHeight}px`)
  if (h.theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', h.theme)
  if (h.contrast === 'high') root.setAttribute('data-contrast', 'high')
  else root.removeAttribute('data-contrast')
}
