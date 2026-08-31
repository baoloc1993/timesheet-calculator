// `make migrate` — di trú config.json ngoài Electron (dùng cùng module electron-store).
import Store from 'electron-store'
import { chayMigration, SCHEMA_VERSION_HIEN_TAI } from './migrations'
import type { NhanVien } from '../../core/types'

interface Schema {
  nhanVien: NhanVien[]
  appConfig: Record<string, unknown>
}

const opts: Store.Options<Schema> = { name: 'config' }
if (process.env.TSC_CONFIG_DIR) opts.cwd = process.env.TSC_CONFIG_DIR
const store = new Store<Schema>(opts)

const truoc = (store.get('appConfig.schemaVersion') as number) || 0
if (truoc >= SCHEMA_VERSION_HIEN_TAI) {
  console.log(`config.json đã ở schemaVersion ${truoc} — không cần migrate.`)
  process.exit(0)
}

console.log(`Migrate config.json: v${truoc} → v${SCHEMA_VERSION_HIEN_TAI}`)
const sau = chayMigration(
  { nhanVien: store.get('nhanVien', []), appConfig: store.get('appConfig', {}) },
  truoc
)
store.set('nhanVien', sau.nhanVien)
store.set('appConfig', { ...sau.appConfig, schemaVersion: SCHEMA_VERSION_HIEN_TAI })
console.log(`Xong. ${sau.nhanVien.length} nhân viên. File: ${store.path}`)
