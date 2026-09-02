// Bọc electron-store — chỗ DUY NHẤT chạm config.json.

import Store from 'electron-store'
import { randomUUID } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import type { NhanVien } from '../../core/types'
import type { KetQuaKy } from '../../core/ketQuaKy'
import { chuanHoaMa } from '../../core/ma'
import { chayMigration, SCHEMA_VERSION_HIEN_TAI } from './migrations'
import { saoLuuTruocMigrate } from './saoLuu'

export interface AppConfig {
  schemaVersion: number
  thuMucXuatGanNhat: string
  fileMauBangLuongGanNhat: string
  kyXuLyGanNhat: string
}

interface Schema {
  nhanVien: NhanVien[]
  appConfig: AppConfig
  /** Vòng 3 — lịch sử kết quả từng kỳ, khoá theo `thang` ("2026-09"). */
  ketQuaKy: Record<string, KetQuaKy>
}

const MAC_DINH: Schema = {
  nhanVien: [],
  appConfig: {
    schemaVersion: SCHEMA_VERSION_HIEN_TAI,
    thuMucXuatGanNhat: '',
    fileMauBangLuongGanNhat: '',
    kyXuLyGanNhat: ''
  },
  ketQuaKy: {}
}

let store: Store<Schema>

export function moStore(): Store<Schema> {
  if (store) return store
  const opts: Store.Options<Schema> = { name: 'config', defaults: MAC_DINH }
  if (process.env.TSC_CONFIG_DIR) opts.cwd = process.env.TSC_CONFIG_DIR
  store = new Store<Schema>(opts)

  // migrate nếu schemaVersion cũ
  const truoc = store.get('appConfig.schemaVersion', 0)
  if (truoc < SCHEMA_VERSION_HIEN_TAI) {
    saoLuuTruocMigrate(store.path) // config.json.bak trước khi đổi schema — rollback
    const duLieu = {
      nhanVien: store.get('nhanVien', []),
      appConfig: store.get('appConfig'),
      ketQuaKy: store.get('ketQuaKy', {})
    }
    const sau = chayMigration(duLieu, truoc)
    store.set('nhanVien', sau.nhanVien)
    store.set('appConfig', { ...sau.appConfig, schemaVersion: SCHEMA_VERSION_HIEN_TAI })
    store.set('ketQuaKy', sau.ketQuaKy)
  }

  // seed cho dev/dogfood: nạp danh sách nhân viên nếu store rỗng và có TSC_SEED_FILE
  const seedFile = process.env.TSC_SEED_FILE
  if (seedFile && store.get('nhanVien', []).length === 0 && existsSync(seedFile)) {
    try {
      const ds = JSON.parse(readFileSync(seedFile, 'utf-8')) as Partial<NhanVien>[]
      store.set('nhanVien', ds.map(chuanHoaNhanVien))
    } catch {
      // seed hỏng thì bỏ qua, không chặn app
    }
  }

  // seed kỳ đã lưu cho dogfood dashboard nhiều kỳ.
  const seedKy = process.env.TSC_SEED_KETQUAKY
  if (seedKy && Object.keys(store.get('ketQuaKy', {})).length === 0 && existsSync(seedKy)) {
    try {
      const ds = JSON.parse(readFileSync(seedKy, 'utf-8')) as Record<string, KetQuaKy>
      store.set('ketQuaKy', ds)
    } catch {
      // bỏ qua
    }
  }

  return store
}

export function chuanHoaNhanVien(x: Partial<NhanVien>): NhanVien {
  return {
    id: x.id || randomUUID(),
    maNhanVien: chuanHoaMa(x.maNhanVien),
    tenMay: String(x.tenMay ?? '').trim(),
    tenBangLuong: String(x.tenBangLuong ?? '').trim(),
    nguongGioChuanNgay: Number(x.nguongGioChuanNgay ?? 8.1),
    donGiaNgay: Number(x.donGiaNgay ?? 0),
    donGiaGioOT: Number(x.donGiaGioOT ?? 0),
    an: Boolean(x.an ?? false)
  }
}

export function layNhanVien(): NhanVien[] {
  return moStore().get('nhanVien', [])
}

export function layConfig(): AppConfig {
  return moStore().get('appConfig')
}

export function ghiConfig(patch: Partial<AppConfig>): AppConfig {
  const moi = { ...layConfig(), ...patch }
  moStore().set('appConfig', moi)
  return moi
}

// ---- KếtQuảKỳ (vòng 3) ----

/** Tất cả kỳ đã lưu, mới nhất trên đầu (sort theo `thang` giảm dần). */
export function layDanhSachKy(): KetQuaKy[] {
  const map = moStore().get('ketQuaKy', {})
  return Object.values(map).sort((a, b) => b.thang.localeCompare(a.thang))
}

export function layMotKy(thang: string): KetQuaKy | null {
  return moStore().get('ketQuaKy', {})[thang] ?? null
}

/** Ghi (đè) một kỳ. Bên gọi lo merge khấu trừ/đã-trả cũ trước khi truyền vào. */
export function ghiMotKy(kq: KetQuaKy): void {
  const map = { ...moStore().get('ketQuaKy', {}) }
  map[kq.thang] = kq
  moStore().set('ketQuaKy', map)
}
