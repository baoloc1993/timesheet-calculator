// Bọc electron-store — chỗ DUY NHẤT chạm config.json.

import Store from 'electron-store'
import { randomUUID } from 'crypto'
import { readFileSync, existsSync, copyFileSync } from 'fs'
import { log } from '../logger'
import type { NhanVien } from '../../core/types'
import type { KetQuaKy } from '../../core/ketQuaKy'
import type { HienThi } from '../../core/hienThi'
import { chuanHoaHienThi } from '../../core/hienThi'
import type { CauHinhMayChamCong } from '../../core/mayChamCong'
import { chuanHoaCauHinhMay } from '../../core/mayChamCong'
import type { NguonGanNhat } from '../../core/nguonGanNhat'
import { chuanHoaNguonGanNhat } from '../../core/nguonGanNhat'
import { chuanHoaMa } from '../../core/ma'
import { chayMigration, SCHEMA_VERSION_HIEN_TAI } from './migrations'
import { saoLuuTruocMigrate } from './saoLuu'

export interface AppConfig {
  schemaVersion: number
  thuMucXuatGanNhat: string
  fileMauBangLuongGanNhat: string
  kyXuLyGanNhat: string
  /** Vòng 4 — optional: thiếu thì dùng mặc định tại code, KHÔNG cần migration. */
  hienThi?: HienThi
  /** Vòng 5 — optional: thiếu thì mặc định ip rỗng/cổng 4370 tại code, KHÔNG migration. */
  mayChamCong?: CauHinhMayChamCong
  /** Vòng 7 — optional: nguồn nạp/đồng bộ THÀNH CÔNG gần nhất, tự chạy lại khi mở app. */
  nguonGanNhat?: NguonGanNhat
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

/** Đặt khi migration lỗi và đã khôi phục `.bak` — renderer hiện khuôn Lỗi. */
let loiMigration: string | null = null
export function layLoiMigration(): string | null {
  return loiMigration
}

export function moStore(): Store<Schema> {
  if (store) return store
  const opts: Store.Options<Schema> = { name: 'config', defaults: MAC_DINH }
  if (process.env.TSC_CONFIG_DIR) opts.cwd = process.env.TSC_CONFIG_DIR
  store = new Store<Schema>(opts)

  // migrate nếu schemaVersion cũ
  const truoc = store.get('appConfig.schemaVersion', 0)
  if (truoc < SCHEMA_VERSION_HIEN_TAI) {
    const bak = saoLuuTruocMigrate(store.path) // .bak trước khi đổi schema — rollback
    try {
      const duLieu = {
        nhanVien: store.get('nhanVien', []),
        appConfig: store.get('appConfig'),
        ketQuaKy: store.get('ketQuaKy', {})
      }
      const sau = chayMigration(duLieu, truoc)
      // schemaVersion ghi SAU CÙNG: sập giữa chừng → lần mở sau vẫn thấy version cũ, migrate lại.
      store.set('nhanVien', sau.nhanVien)
      store.set('ketQuaKy', sau.ketQuaKy)
      store.set('appConfig', { ...sau.appConfig, schemaVersion: SCHEMA_VERSION_HIEN_TAI })
      log.info('migrate config', `v${truoc} → v${SCHEMA_VERSION_HIEN_TAI}`)
    } catch (e) {
      // Khôi phục bản cũ từ .bak, chạy tiếp ở chế độ giảm (schemaVersion cũ) + báo người dùng.
      log.error('migrate config lỗi', (e as Error).message, (e as Error).stack || '')
      if (bak && existsSync(bak)) {
        try {
          copyFileSync(bak, store.path)
          store.store = JSON.parse(readFileSync(store.path, 'utf-8'))
        } catch (e2) {
          log.error('khôi phục .bak lỗi', (e2 as Error).message)
        }
      }
      loiMigration =
        'Không nâng cấp được dữ liệu sang phiên bản mới — đã giữ nguyên bản cũ. ' +
        'Lịch sử kỳ có thể chưa dùng được. Thử mở lại app; nếu vẫn lỗi, gửi file log qua nút "Góp ý / báo lỗi".'
    }
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

// ---- Hiển thị (vòng 4) ----

export function layHienThi(): HienThi {
  return chuanHoaHienThi(layConfig().hienThi)
}

export function ghiHienThi(patch: Partial<HienThi>): HienThi {
  const hienThi = chuanHoaHienThi({ ...layHienThi(), ...patch })
  ghiConfig({ hienThi })
  return hienThi
}

// ---- Cấu hình máy chấm công (vòng 5) ----

export function layCauHinhMay(): CauHinhMayChamCong {
  return chuanHoaCauHinhMay(layConfig().mayChamCong)
}

export function ghiCauHinhMay(patch: Partial<CauHinhMayChamCong>): CauHinhMayChamCong {
  const mayChamCong = chuanHoaCauHinhMay({ ...layCauHinhMay(), ...patch })
  ghiConfig({ mayChamCong })
  return mayChamCong
}

// ---- Nguồn nạp/đồng bộ gần nhất (vòng 7) ----

export function layNguonGanNhat(): NguonGanNhat | null {
  return chuanHoaNguonGanNhat(layConfig().nguonGanNhat)
}

export function ghiNguonGanNhat(n: NguonGanNhat): void {
  ghiConfig({ nguonGanNhat: n })
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
