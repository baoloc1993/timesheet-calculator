// Log file cục bộ — không gửi đi đâu (TECHSTACK §2).
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

function ghi(muc: string, ...args: unknown[]) {
  const dong = `${new Date().toISOString()} [${muc}] ${args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')}\n`
  try {
    appendFileSync(duongDanLog(), dong)
  } catch {
    // không chặn app vì lỗi ghi log
  }
  if (muc === 'ERROR') console.error(dong.trim())
  else if (process.env.TSC_LOG_LEVEL === 'debug') console.log(dong.trim())
}

export const log = {
  info: (...a: unknown[]) => ghi('INFO', ...a),
  error: (...a: unknown[]) => ghi('ERROR', ...a),
  thuMuc: () => thuMucLog
}
