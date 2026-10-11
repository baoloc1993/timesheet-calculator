import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { docBangLuong, nhanVienTuBangLuong } from '../../src/main/excel/docBangLuong'

// parser bảng lương phải đọc được file THẬT layout cũ (2 cột/nhân viên,
// KHÔNG có ô mã riêng). Test trên hiện vật của người dùng, không phải file dựng tay.

const FILE = join('deployment/local/mau', 'bang luong thang 07 (mau).xlsx')
const suite = existsSync(FILE) ? describe : describe.skip

suite('docBangLuong trên file bảng lương thật 07/2026 (layout cũ, không cột mã)', () => {
  it('không ném lỗi, rút ra được nhiều thẻ nhân viên', async () => {
    const { doc } = await docBangLuong(FILE)
    expect(doc.the.length).toBeGreaterThanOrEqual(10)
  })

  it('mọi thẻ có tên bảng lương (khớp-theo-tên là đường duy nhất khi file không có mã)', async () => {
    const { doc } = await docBangLuong(FILE)
    for (const t of doc.the) {
      expect(t.tenBangLuong.trim()).not.toBe('')
      expect(t.maNhanVien).toBe('') // file cũ: không ô mã → mã rỗng, không được bịa
    }
  })

  it('đọc đúng đơn giá của ít nhất một thẻ đối chiếu được bằng mắt (Ông Dũng)', async () => {
    const { doc } = await docBangLuong(FILE)
    const dung = doc.the.find((t) => t.tenBangLuong === 'Ông Dũng')
    expect(dung).toBeDefined()
    expect(dung!.donGiaNgay).toBe(285000)
    expect(dung!.donGiaGioOT).toBe(70000)
    // ô để ghi đè phải trỏ đúng cột số lượng / đơn giá
    expect(dung!.oSoLuongNgay).toMatch(/^[A-Z]\d+$/)
  })

  it('chữ số Ở CUỐI tên không bị nuốt thành mã', async () => {
    const { doc } = await docBangLuong(FILE)
    const lan68 = doc.the.find((t) => /Lan 68$/.test(t.tenBangLuong))
    const lan89 = doc.the.find((t) => t.tenBangLuong === 'Lan89')
    expect(lan68?.tenBangLuong).toBe('Bác Lan 68')
    expect(lan68?.maNhanVien).toBe('')
    expect(lan89?.tenBangLuong).toBe('Lan89')
    expect(lan89?.maNhanVien).toBe('')
  })

  it('nhanVienTuBangLuong giữ mọi thẻ (khớp theo tên ở bước trộn), không thẻ nào mất', async () => {
    const { doc } = await docBangLuong(FILE)
    const rut = nhanVienTuBangLuong(doc)
    expect(rut).toHaveLength(doc.the.length)
    for (const r of rut) expect(String(r.tenBangLuong).trim()).not.toBe('')
  })
})
