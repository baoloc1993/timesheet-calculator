// Di trú schema config.json. Mỗi bước có `up` và `down` (BACKWARD-COMPATIBILITY §2 —
// migration nào cũng phải có đường xuống). `make migrate` chạy tuần tự tới version đích.

import type { NhanVien } from '../../core/types'
import type { KetQuaKy } from '../../core/ketQuaKy'

export const SCHEMA_VERSION_HIEN_TAI = 2

export interface DuLieuConfig {
  nhanVien: NhanVien[]
  appConfig: Record<string, unknown>
  ketQuaKy: Record<string, KetQuaKy>
}

type DuLieuVao = {
  nhanVien: NhanVien[]
  appConfig: Record<string, unknown> | object
  ketQuaKy?: Record<string, KetQuaKy>
}

interface BuocMigration {
  up: (d: DuLieuConfig) => DuLieuConfig
  down: (d: DuLieuConfig) => DuLieuConfig
}

// BUOC[i] = giữa version i và i+1.
const BUOC: BuocMigration[] = [
  // v0 ↔ v1: khởi tạo cấu trúc — đảm bảo mọi NhanVien có đủ field, appConfig có khoá cần.
  {
    up: (d) => ({
      nhanVien: (d.nhanVien || []).map((n) => ({
        id: n.id,
        maNhanVien: n.maNhanVien,
        tenMay: n.tenMay,
        tenBangLuong: n.tenBangLuong ?? n.tenMay,
        nguongGioChuanNgay: n.nguongGioChuanNgay ?? 8.1,
        donGiaNgay: n.donGiaNgay ?? 0,
        donGiaGioOT: n.donGiaGioOT ?? 0,
        an: n.an ?? false
      })),
      appConfig: {
        thuMucXuatGanNhat: '',
        fileMauBangLuongGanNhat: '',
        kyXuLyGanNhat: '',
        ...d.appConfig,
        schemaVersion: 1
      },
      ketQuaKy: d.ketQuaKy ?? {}
    }),
    // Không có gì để bỏ khi về v0 — chỉ hạ số version.
    down: (d) => ({ ...d, appConfig: { ...d.appConfig, schemaVersion: 0 } })
  },
  // v1 ↔ v2 (vòng 3): THÊM collection KếtQuảKỳ. Additive thuần — NhanVien/AppConfig không đụng.
  {
    up: (d) => ({
      ...d,
      ketQuaKy: d.ketQuaKy ?? {},
      appConfig: { ...d.appConfig, schemaVersion: 2 }
    }),
    // Về v1: bỏ ketQuaKy (bản 0.2.0 không đọc khoá này). Trả `{}` ở kiểu dữ liệu;
    // `migrate-cli.ts` xoá hẳn khoá khỏi config.json khi hạ version. `.bak` là lưới an toàn.
    down: (d) => ({
      nhanVien: d.nhanVien,
      appConfig: { ...d.appConfig, schemaVersion: 1 },
      ketQuaKy: {}
    })
  }
]

/**
 * Chạy migration từ `tuVersion` tới `denVersion` (mặc định = hiện tại).
 * `den > tu` → chạy `up` tuần tự; `den < tu` → chạy `down` lùi dần.
 */
export function chayMigration(
  d: DuLieuVao,
  tuVersion: number,
  denVersion: number = SCHEMA_VERSION_HIEN_TAI
): DuLieuConfig {
  let cur: DuLieuConfig = {
    nhanVien: d.nhanVien,
    appConfig: d.appConfig as Record<string, unknown>,
    ketQuaKy: d.ketQuaKy ?? {}
  }
  if (denVersion > tuVersion) {
    for (let v = tuVersion; v < denVersion; v++) {
      const b = BUOC[v]
      if (b) cur = b.up(cur)
    }
  } else if (denVersion < tuVersion) {
    for (let v = tuVersion - 1; v >= denVersion; v--) {
      const b = BUOC[v]
      if (b) cur = b.down(cur)
    }
  }
  return cur
}
