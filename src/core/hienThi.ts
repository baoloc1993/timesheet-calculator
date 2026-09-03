// Thiết lập cá nhân hoá hiển thị (vòng 4) — hàm thuần, không phụ thuộc Electron.

export interface HienThi {
  scale: 1 | 1.15 | 1.3
  rowHeight: 42 | 52 | 64
  theme: 'light' | 'dark' | 'auto'
  contrast: 'normal' | 'high'
}

export const MAC_DINH_HIEN_THI: HienThi = {
  scale: 1,
  rowHeight: 52,
  theme: 'auto',
  contrast: 'normal'
}

const SCALE_HOP_LE = [1, 1.15, 1.3]
const ROW_HOP_LE = [42, 52, 64]

/** Field lạ/thiếu/hỏng → về mặc định từng field, không throw. */
export function chuanHoaHienThi(x: Partial<HienThi> | undefined | null): HienThi {
  return {
    scale: SCALE_HOP_LE.includes(x?.scale as number) ? (x!.scale as HienThi['scale']) : MAC_DINH_HIEN_THI.scale,
    rowHeight: ROW_HOP_LE.includes(x?.rowHeight as number)
      ? (x!.rowHeight as HienThi['rowHeight'])
      : MAC_DINH_HIEN_THI.rowHeight,
    theme: x?.theme === 'light' || x?.theme === 'dark' ? x.theme : 'auto',
    contrast: x?.contrast === 'high' ? 'high' : 'normal'
  }
}
