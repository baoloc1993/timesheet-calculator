// Chuẩn bị cache electron-builder TRƯỚC khi `electron-builder --win nsis` chạy.
//
// Vì sao cần: gói `winCodeSign-2.6.0.7z` của electron-builder chứa symlink cho macOS
// (darwin/*.dylib). Trên Windows KHÔNG bật Developer Mode / không chạy admin, 7za bung
// gói này sẽ lỗi "Cannot create symbolic link : A required privilege is not held by the
// client" và electron-builder coi đó là lỗi chí mạng (exit status 2) — build đứng ngay
// bước packaging, trước cả khi tạo installer.
//
// Cách xử: tự tải gói rồi bung, LOẠI thư mục `darwin` (Windows build không dùng tới nó).
// Bung vào đúng thư mục cache electron-builder trông đợi (`winCodeSign-2.6.0`) → khi
// electron-builder chạy, nó thấy cache có sẵn và bỏ qua bước tải + bung.
//
// Idempotent: thư mục đích đã tồn tại thì thoát ngay. Không cần mạng ở lần chạy sau.
// Bối cảnh: "wincodesign"

import { existsSync, mkdirSync, createWriteStream, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { path7za } from '7zip-bin'

const VERSION = 'winCodeSign-2.6.0'
const URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${VERSION}/${VERSION}.7z`

const cacheRoot =
  process.env.ELECTRON_BUILDER_CACHE ||
  join(process.env.LOCALAPPDATA || join(process.env.HOME || '', 'AppData', 'Local'), 'electron-builder', 'Cache')
const dest = join(cacheRoot, 'winCodeSign', VERSION)

if (existsSync(dest)) {
  console.log(`prep-build-cache: ${VERSION} đã có ở cache — bỏ qua`)
  process.exit(0)
}

const tmp7z = join(cacheRoot, 'winCodeSign', `${VERSION}.prep.7z`)
mkdirSync(join(cacheRoot, 'winCodeSign'), { recursive: true })

console.log(`prep-build-cache: tải ${URL}`)
const res = await fetch(URL)
if (!res.ok) {
  console.error(`prep-build-cache: tải thất bại — HTTP ${res.status}. Bật Windows Developer Mode rồi chạy lại, hoặc chạy make deploy với quyền admin.`)
  process.exit(1)
}
await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp7z))

console.log(`prep-build-cache: bung vào ${dest} (loại thư mục darwin)`)
mkdirSync(dest, { recursive: true })
// 7za trả 0 vì đã loại darwin — không còn symlink nào để tạo.
execFileSync(path7za, ['x', '-bd', '-y', `-o${dest}`, tmp7z, '-x!darwin'], { stdio: 'inherit' })
rmSync(tmp7z, { force: true })
console.log('prep-build-cache: xong')
