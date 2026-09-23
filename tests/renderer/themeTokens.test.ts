// Chặn hồi quy token màu: theme.css phải có đủ token màu trong :root và giữ hai ràng buộc khoá.
// Không snapshot CSS.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')
const css = readFileSync(resolve(ROOT, 'src/renderer/src/theme.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
)

/** Mọi khối lá (không lồng) dạng `selector { khai báo }`, selector đã chuẩn hoá khoảng trắng. */
function leafBlocks(src: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const selector = m[1].trim().split('\n').pop()!.trim().replace(/\s+/g, ' ')
    out.push({ selector, body: m[2] })
  }
  return out
}

function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of body.split(';')) {
    const i = part.indexOf(':')
    if (i < 0) continue
    const name = part.slice(0, i).trim()
    if (name.startsWith('--')) map.set(name, part.slice(i + 1).trim())
  }
  return map
}

const blocks = leafBlocks(css)
const rootBlock = blocks.find((b) => b.selector === ':root')
const rootVars = declarations(rootBlock?.body ?? '')

describe('theme.css — token màu', () => {
  it('tìm được khối :root đầu tiên với đủ token màu', () => {
    expect(rootBlock, 'không thấy khối :root trong theme.css').toBeDefined()
    const mau = [...rootVars.entries()].filter(
      ([name, v]) => name.startsWith('--color-') && /^#[0-9a-f]{3,8}$/i.test(v)
    )
    expect(mau.length).toBeGreaterThanOrEqual(25)
  })

  it('--color-warning-soft khoá #fff4ce — trùng màu fill ô vàng trong file Excel xuất ra', () => {
    expect(rootVars.get('--color-warning-soft')?.toLowerCase()).toBe('#fff4ce')
  })

  it('cả 3 khối tương phản cao tắt bóng thẻ (--shadow-card: none)', () => {
    const highContrast = blocks.filter(
      (b) => /\[data-contrast="high"\]$/.test(b.selector) && declarations(b.body).size > 0
    )
    expect(highContrast.map((b) => b.selector)).toEqual([
      ':root[data-contrast="high"]',
      ':root:not([data-theme="light"])[data-contrast="high"]',
      ':root[data-theme="dark"][data-contrast="high"]'
    ])
    for (const b of highContrast) {
      expect(declarations(b.body).get('--shadow-card'), b.selector).toBe('none')
    }
  })
})
