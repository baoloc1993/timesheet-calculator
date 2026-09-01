// Bọc electron-store — chỗ DUY NHẤT chạm config.json.

import Store from 'electron-store'
import { randomUUID } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import type { NhanVien } from '../../core/types'
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
}

const MAC_DINH: Schema = {
  nhanVien: [],
  appConfig: {
    schemaVersion: SCHEMA_VERSION_HIEN_TAI,
    thuMucXuatGanNhat: '',
    fileMauBangLuongGanNhat: '',
    kyXuLyGanNhat: ''
  }
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
    const duLieu = { nhanVien: store.get('nhanVien', []), appConfig: store.get('appConfig') }
    const sau = chayMigration(duLieu, truoc)
    store.set('nhanVien', sau.nhanVien)
    store.set('appConfig', { ...sau.appConfig, schemaVersion: SCHEMA_VERSION_HIEN_TAI })
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
