// `make migrate` — di trú config.json ngoài Electron (dùng cùng module electron-store).
// Mặc định nâng tới version hiện tại. Truyền version đích để HẠ chủ động:
//   npm run migrate -- 1     (hạ config.json về schemaVersion 1)
import Store from 'electron-store'
import { chayMigration, SCHEMA_VERSION_HIEN_TAI } from './migrations'
import { saoLuuTruocMigrate } from './saoLuu'
import type { NhanVien } from '../../core/types'
import type { KetQuaKy } from '../../core/ketQuaKy'

interface Schema {
  nhanVien: NhanVien[]
  appConfig: Record<string, unknown>
  ketQuaKy: Record<string, KetQuaKy>
}

const opts: Store.Options<Schema> = { name: 'config' }
if (process.env.TSC_CONFIG_DIR) opts.cwd = process.env.TSC_CONFIG_DIR
const store = new Store<Schema>(opts)

const truoc = (store.get('appConfig.schemaVersion') as number) || 0
const argDich = process.argv[2] != null ? Number(process.argv[2]) : SCHEMA_VERSION_HIEN_TAI
const dich = Number.isFinite(argDich) ? argDich : SCHEMA_VERSION_HIEN_TAI

if (dich === truoc) {
  console.log(`config.json đã ở schemaVersion ${truoc} — không cần migrate.`)
  process.exit(0)
}

console.log(`Migrate config.json: v${truoc} → v${dich}`)
const bak = saoLuuTruocMigrate(store.path)
if (bak) console.log(`Đã sao lưu: ${bak}`)
const sau = chayMigration(
  {
    nhanVien: store.get('nhanVien', []),
    appConfig: store.get('appConfig', {}),
    ketQuaKy: store.get('ketQuaKy', {})
  },
  truoc,
  dich
)
store.set('nhanVien', sau.nhanVien)
store.set('appConfig', { ...sau.appConfig, schemaVersion: dich })
store.set('ketQuaKy', sau.ketQuaKy)
console.log(
  `Xong. ${sau.nhanVien.length} nhân viên, ${Object.keys(sau.ketQuaKy).length} kỳ đã lưu. File: ${store.path}`
)
