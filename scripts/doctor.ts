// `make doctor` — kiểm môi trường chạy Timesheet Calculator.
import { existsSync, accessSync, constants, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir, platform } from 'os'
import { execSync } from 'child_process'

let loi = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const no = (m: string) => {
  console.log(`  ✗ ${m}`)
  loi++
}

console.log('\nTimesheet Calculator — doctor\n')

// Node
const nv = process.versions.node
const major = Number(nv.split('.')[0])
major >= 20 ? ok(`Node ${nv}`) : no(`Node ${nv} — cần ≥ 20`)

// npm
try {
  ok(`npm ${execSync('npm -v').toString().trim()}`)
} catch {
  no('không gọi được npm')
}

// node_modules
existsSync(join(process.cwd(), 'node_modules', 'electron'))
  ? ok('đã cài dependencies (electron có mặt)')
  : no('chưa chạy npm install (thiếu electron)')

// thư mục cấu hình + quyền ghi
const cfgDir =
  process.env.TSC_CONFIG_DIR ||
  (platform() === 'win32'
    ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'timesheet-calculator')
    : join(homedir(), '.config', 'timesheet-calculator'))
try {
  mkdirSync(cfgDir, { recursive: true })
  accessSync(cfgDir, constants.W_OK)
  ok(`ghi được thư mục cấu hình: ${cfgDir}`)
  console.log(`     · config.json  → ${join(cfgDir, 'config.json')}`)
  console.log(`     · logs/        → ${join(cfgDir, 'logs')}`)
} catch {
  no(`không ghi được thư mục cấu hình: ${cfgDir}`)
}

// file mẫu dogfood
const mau = join(process.cwd(), 'deployment', 'local', 'mau')
existsSync(mau) ? ok(`có file mẫu dogfood: ${mau}`) : no(`thiếu ${mau} (chép từ D:\\Bang luong)`)

console.log(loi === 0 ? '\nTất cả OK.\n' : `\n${loi} vấn đề cần xử.\n`)
process.exit(loi === 0 ? 0 : 1)
