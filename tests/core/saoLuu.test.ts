// Sao lưu config.json trước migrate — luồng dữ liệu quan trọng (mất = mất toàn bộ Setup).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { saoLuuTruocMigrate } from '../../src/main/settings/saoLuu'

let dir: string
const cfg = () => join(dir, 'config.json')

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tsc-saoluu-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('saoLuuTruocMigrate', () => {
  it('chép config.json → config.json.bak với nội dung y hệt', () => {
    const noiDung = JSON.stringify({ nhanVien: [{ maNhanVien: '00002' }], appConfig: { schemaVersion: 0 } })
    writeFileSync(cfg(), noiDung)

    const bak = saoLuuTruocMigrate(cfg())

    expect(bak).toBe(cfg() + '.bak')
    expect(existsSync(bak!)).toBe(true)
    expect(readFileSync(bak!, 'utf8')).toBe(noiDung)
  })

  it('trả null khi chưa có config.json (lần chạy đầu, không có gì để lưu)', () => {
    expect(saoLuuTruocMigrate(cfg())).toBeNull()
    expect(existsSync(cfg() + '.bak')).toBe(false)
  })

  it('ghi đè .bak cũ ở lần migrate sau', () => {
    writeFileSync(cfg(), 'v1')
    saoLuuTruocMigrate(cfg())
    writeFileSync(cfg(), 'v2')
    saoLuuTruocMigrate(cfg())
    expect(readFileSync(cfg() + '.bak', 'utf8')).toBe('v2')
  })

  it('khôi phục được: chép .bak đè lại config.json cho ra trạng thái trước migrate', () => {
    const goc = JSON.stringify({ nhanVien: [{ maNhanVien: '00006', nguongGioChuanNgay: 8.6 }] })
    writeFileSync(cfg(), goc)
    const bak = saoLuuTruocMigrate(cfg())!

    writeFileSync(cfg(), '{"hỏng":true}') // giả lập migrate làm hỏng file

    // rollback
    writeFileSync(cfg(), readFileSync(bak, 'utf8'))
    expect(JSON.parse(readFileSync(cfg(), 'utf8'))).toEqual(JSON.parse(goc))
  })
})
