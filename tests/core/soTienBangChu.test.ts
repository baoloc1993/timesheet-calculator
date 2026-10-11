// đọc số tiền thành chữ tiếng Việt (S13, phiếu lương).
import { describe, it, expect } from 'vitest'
import { docSoTienBangChu } from '../../src/core/soTienBangChu'

describe('docSoTienBangChu — ca cơ bản', () => {
  it('số 0 → "Không đồng"', () => {
    expect(docSoTienBangChu(0)).toBe('Không đồng')
  })

  it('số âm → tiền tố "Âm "', () => {
    expect(docSoTienBangChu(-5000)).toBe('Âm năm nghìn đồng')
    expect(docSoTienBangChu(-1234567)).toBe('Âm một triệu hai trăm ba mươi bốn nghìn năm trăm sáu mươi bảy đồng')
  })
})

describe('docSoTienBangChu — ca "lẻ" (nhóm có hàng trăm=0 sau một nhóm khác 0)', () => {
  it('105 → "một trăm lẻ năm"', () => {
    expect(docSoTienBangChu(105)).toBe('Một trăm lẻ năm đồng')
  })

  it('1005 → nhóm nghìn ép đọc "không trăm lẻ năm"', () => {
    expect(docSoTienBangChu(1005)).toBe('Một nghìn không trăm lẻ năm đồng')
  })

  it('1001000 → nhóm giữa (nghìn) = 1 vẫn đọc "không trăm lẻ một nghìn"', () => {
    expect(docSoTienBangChu(1001000)).toBe('Một triệu không trăm lẻ một nghìn đồng')
  })
})

describe('docSoTienBangChu — ca "mốt"/"lăm" ở hàng chục-đơn vị', () => {
  it('21 → "hai mươi mốt" (không phải "hai mươi một")', () => {
    expect(docSoTienBangChu(21)).toBe('Hai mươi mốt đồng')
  })

  it('25 → "hai mươi lăm" (không phải "hai mươi năm")', () => {
    expect(docSoTienBangChu(25)).toBe('Hai mươi lăm đồng')
  })

  it('15 → "mười lăm" (mười + lăm, không phải "mười năm")', () => {
    expect(docSoTienBangChu(15)).toBe('Mười lăm đồng')
  })

  it('1025000 → giữ "mốt"/"lăm" đúng trong nhóm nghìn', () => {
    expect(docSoTienBangChu(1025000)).toBe('Một triệu không trăm hai mươi lăm nghìn đồng')
  })
})

describe('docSoTienBangChu — số tròn nghìn/triệu/tỷ', () => {
  it('1.000 → "một nghìn"', () => {
    expect(docSoTienBangChu(1000)).toBe('Một nghìn đồng')
  })

  it('1.000.000 → "một triệu"', () => {
    expect(docSoTienBangChu(1000000)).toBe('Một triệu đồng')
  })

  it('1.000.000.000 → "một tỷ"', () => {
    expect(docSoTienBangChu(1000000000)).toBe('Một tỷ đồng')
  })
})

describe('docSoTienBangChu — số lớn nhiều nhóm', () => {
  it('1.234.567.000 → đọc đủ 3 nhóm tỷ/triệu/nghìn', () => {
    expect(docSoTienBangChu(1234567000)).toBe(
      'Một tỷ hai trăm ba mươi bốn triệu năm trăm sáu mươi bảy nghìn đồng'
    )
  })

  it('6.435.000 (kỳ lương thật) → khớp cách đọc kế toán quen dùng', () => {
    expect(docSoTienBangChu(6435000)).toBe('Sáu triệu bốn trăm ba mươi lăm nghìn đồng')
  })
})

describe('docSoTienBangChu — thập phân bị làm tròn trước khi đọc', () => {
  it('1500.6 → làm tròn lên 1501 rồi mới đọc (không cắt cụt còn 1500)', () => {
    expect(docSoTienBangChu(1500.6)).toBe('Một nghìn năm trăm lẻ một đồng')
  })

  it('999.4 → làm tròn xuống 999, không vọt lên nghìn', () => {
    expect(docSoTienBangChu(999.4)).toBe('Chín trăm chín mươi chín đồng')
  })
})
