// Log file cục bộ — không gửi đi đâu (TECHSTACK §2: app offline, error tracking = log file).
// Định dạng: một dòng JSON / bản ghi (timestamp + mức độ + ngữ cảnh) — lần lại một
// lỗi tính công mà không phải đoán.
import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'

let thuMucLog = ''

function duongDanLog(): string {
  if (!thuMucLog) {
    thuMucLog = process.env.TSC_CONFIG_DIR
      ? join(process.env.TSC_CONFIG_DIR, 'logs')
      : join(app.getPath('userData'), 'logs')
    try {
      mkdirSync(thuMucLog, { recursive: true })
    } catch {
      // bỏ qua
    }
  }
  const ngay = new Date().toISOString().slice(0, 10)
  return join(thuMucLog, `${ngay}.log`)
}

type Muc = 'INFO' | 'ERROR' | 'EVENT'

function ghi(muc: Muc, msg: string, ctx?: unknown) {
  const banGhi: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level: muc.toLowerCase(),
    msg
  }
  if (ctx !== undefined) banGhi.ctx = ctx
  const dong = JSON.stringify(banGhi) + '\n'
  try {
    appendFileSync(duongDanLog(), dong)
  } catch {
    // không chặn app vì lỗi ghi log
  }
  if (muc === 'ERROR') console.error(dong.trim())
  else if (process.env.TSC_LOG_LEVEL === 'debug') console.log(dong.trim())
}

/** Gộp các tham số tự do thành một chuỗi thông điệp (giữ chữ ký cũ của log.info/error). */
function gop(args: unknown[]): { msg: string; ctx?: unknown } {
  const phanChuoi = args.filter((a) => typeof a === 'string') as string[]
  const phanKhac = args.filter((a) => typeof a !== 'string')
  return {
    msg: phanChuoi.join(' ') || '(không có thông điệp)',
    ctx: phanKhac.length ? (phanKhac.length === 1 ? phanKhac[0] : phanKhac) : undefined
  }
}

export const log = {
  info: (...a: unknown[]) => {
    const { msg, ctx } = gop(a)
    ghi('INFO', msg, ctx)
  },
  error: (...a: unknown[]) => {
    const { msg, ctx } = gop(a)
    ghi('ERROR', msg, ctx)
  },
  /**
   * Event của luồng lõi — thay cho analytics từ xa (app offline, một người dùng,
   * dữ liệu không rời máy —). Đủ để đối chiếu số kỳ đã xử lý
   * với sổ. Tên event: `nap-file-may`, `xuat-hoan-tat`,
   * `xuat-that-bai`, `khai-nhan-vien-thieu`.
   */
  event: (ten: string, chiTiet?: Record<string, unknown>) => ghi('EVENT', ten, chiTiet),
  thuMuc: () => thuMucLog
}
