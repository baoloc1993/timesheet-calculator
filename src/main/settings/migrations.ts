// Di trú schema config.json. `make migrate` chạy các bước tuần tự, bump schemaVersion.

import type { NhanVien } from '../../core/types'

export const SCHEMA_VERSION_HIEN_TAI = 1

interface DuLieuConfig {
  nhanVien: NhanVien[]
  appConfig: Record<string, unknown>
}

type DuLieuVao = { nhanVien: NhanVien[]; appConfig: Record<string, unknown> | object }

type BuocMigration = (d: DuLieuConfig) => DuLieuConfig

// mảng migration: index i = nâng từ version i lên i+1
const BUOC: BuocMigration[] = [
  // v0 → v1: khởi tạo cấu trúc — đảm bảo mọi NhanVien có đủ field, appConfig có khoá cần.
  (d) => ({
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
    }
  })
]

export function chayMigration(d: DuLieuVao, tuVersion: number): DuLieuConfig {
  let cur: DuLieuConfig = { nhanVien: d.nhanVien, appConfig: d.appConfig as Record<string, unknown> }
  for (let v = tuVersion; v < SCHEMA_VERSION_HIEN_TAI; v++) {
    const buoc = BUOC[v]
    if (buoc) cur = buoc(cur)
  }
  return cur
}
