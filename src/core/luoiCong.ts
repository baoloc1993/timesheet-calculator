// bảng công cả tháng (S11). Hàm thuần, không phụ thuộc Electron/fs/exceljs.

export type KyHieuNgay = 'X' | '½' | 'CN' | 'vang'

/** Ngày ISO "YYYY-MM-DD" có phải Chủ Nhật — suy từ lịch, không cần dữ liệu thêm. */
export function ngayLaChuNhat(ngayIso: string): boolean {
  const m = ngayIso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return false
  // Date.UTC tránh lệch múi giờ máy chạy (CI/dev khác TZ Việt Nam).
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay() === 0
}

/**
 * Suy ký hiệu công một ngày từ `KetQuaNgay.ngayCongR` — X đủ công · ½ nửa công ·
 * Vắng (không chấm công, không phân loại lý do) · CN Chủ Nhật (suy từ lịch).
 * KHÔNG đọc `otBiEp`/`gioOtS` — giờ OT hiển thị tách riêng trong ô, không đổi ký hiệu chính.
 */
export function dungKyHieuNgay(ngayCongR: number, isChuNhat: boolean): KyHieuNgay {
  if (ngayCongR === 1) return 'X'
  if (ngayCongR === 0.5) return '½'
  return isChuNhat ? 'CN' : 'vang'
}
