import { describe, it, expect } from 'vitest'
import { xuLyKyCong, tinhLaiMotDong, suaNgayCongTrucTiep, tinhLaiTongHop } from '../../src/core/xuLyKyCong'
import type { FileMayDaDoc, NhanVien, DongNgayMay, KetQuaNgay } from '../../src/core/types'

// Luồng lõi bước 3-5: ghép nhân viên theo maNhanVien, chặn khi
// thiếu Setup (AC-6), tính lại sạch khi nạp lại cùng kỳ, sửa tay một dòng.

function ngay(d: string, moc: (string | null)[]): DongNgayMay {
  return { ngay: d, thu: '', moc: [...moc, null, null, null, null, null, null].slice(0, 6), congMay: null, otMay: null }
}

function nv(over: Partial<NhanVien> & Pick<NhanVien, 'maNhanVien' | 'tenMay'>): NhanVien {
  return {
    id: 'id-' + over.maNhanVien,
    tenBangLuong: over.tenMay,
    nguongGioChuanNgay: 8.1,
    donGiaNgay: 240000,
    donGiaGioOT: 70000,
    an: false,
    ...over
  }
}

const ngayThuong = ['07:00', '11:00', '13:00', '17:00'] // Q=8, R=1, S=0 với ngưỡng 8.1

function fileMay(khoi: { maNhanVien: string; tenMay: string; dongNgay: DongNgayMay[] }[]): FileMayDaDoc {
  return { thang: '2026-08', ngayBatDau: '2026-08-01', ngayKetThuc: '2026-08-31', khoi }
}

describe('xuLyKyCong — ghép nhân viên + chặn thiếu Setup (AC-6)', () => {
  it('khối trong file máy chưa khai Setup → vào thieuSetup, KHÔNG được tính', () => {
    const file = fileMay([
      { maNhanVien: '00002', tenMay: 'Hai', dongNgay: [ngay('2026-08-01', ngayThuong)] },
      { maNhanVien: '00099', tenMay: 'NguoiLa', dongNgay: [ngay('2026-08-01', ngayThuong)] }
    ])
    const kq = xuLyKyCong(file, [nv({ maNhanVien: '00002', tenMay: 'Hai' })])

    expect(kq.thieuSetup).toEqual([{ maNhanVien: '00099', tenMay: 'NguoiLa' }])
    expect(kq.tongHop.map((t) => t.maNhanVien)).toEqual(['00002'])
    // tổng kỳ chỉ gồm người đã khai — không rò công của người lạ
    expect(kq.tongNgayCongCaKy).toBe(1)
  })

  it('ghép theo maNhanVien, KHÔNG theo tenMay (mã ổn định, tên máy gõ khác nhau)', () => {
    const file = fileMay([
      { maNhanVien: '00015', tenMay: 'CHUNG', dongNgay: [ngay('2026-08-01', ngayThuong)] }
    ])
    const kq = xuLyKyCong(file, [nv({ maNhanVien: '00015', tenMay: 'Ông Dũng', nguongGioChuanNgay: 10.6 })])

    expect(kq.thieuSetup).toEqual([])
    expect(kq.tongHop).toHaveLength(1)
    expect(kq.tongHop[0].maNhanVien).toBe('00015')
    expect(kq.tongHop[0].nguongGioChuanNgay).toBe(10.6) // dùng ngưỡng từ Setup, không phải mặc định
  })

  it('mỗi người tính bằng ngưỡng giờ chuẩn RIÊNG của mình', () => {
    const dn = [ngay('2026-08-01', ['07:00', '11:30', '13:30', '18:00'])] // Q=9
    const file = fileMay([
      { maNhanVien: 'A', tenMay: 'A', dongNgay: dn },
      { maNhanVien: 'B', tenMay: 'B', dongNgay: dn }
    ])
    const kq = xuLyKyCong(file, [
      nv({ maNhanVien: 'A', tenMay: 'A', nguongGioChuanNgay: 8.1 }),
      nv({ maNhanVien: 'B', tenMay: 'B', nguongGioChuanNgay: 8.6 })
    ])
    const a = kq.tongHop.find((t) => t.maNhanVien === 'A')!
    const b = kq.tongHop.find((t) => t.maNhanVien === 'B')!
    expect(a.tongGioOT).toBeCloseTo(0.9, 4)
    expect(b.tongGioOT).toBeCloseTo(0.4, 4)
  })
})

describe('xuLyKyCong — nạp lại cùng kỳ tính lại từ đầu (ca biên "Trùng dữ liệu")', () => {
  it('gọi hai lần trên cùng dữ liệu → kết quả GIỐNG HỆT (không cộng dồn, không giữ trạng thái cũ)', () => {
    const file = fileMay([
      { maNhanVien: '00003', tenMay: 'My83', dongNgay: [
        ngay('2026-08-01', ['06:53', '11:19', '13:34', '18:05']),
        ngay('2026-08-02', ngayThuong),
        ngay('2026-08-03', [])
      ] }
    ])
    const list = [nv({ maNhanVien: '00003', tenMay: 'My83' })]

    const lan1 = xuLyKyCong(file, list)
    const lan2 = xuLyKyCong(file, list)
    expect(lan2).toEqual(lan1)
  })

  it('tổng kỳ = tổng của các nhân viên (Σ R và Σ S cộng đúng)', () => {
    const file = fileMay([
      { maNhanVien: 'A', tenMay: 'A', dongNgay: [ngay('2026-08-01', ngayThuong), ngay('2026-08-02', [])] },
      { maNhanVien: 'B', tenMay: 'B', dongNgay: [ngay('2026-08-01', ['07:00', '11:30', '13:30', '18:00'])] }
    ])
    const kq = xuLyKyCong(file, [
      nv({ maNhanVien: 'A', tenMay: 'A' }),
      nv({ maNhanVien: 'B', tenMay: 'B' })
    ])
    const sumR = kq.tongHop.reduce((s, t) => s + t.tongNgayCong, 0)
    const sumS = kq.tongHop.reduce((s, t) => s + t.tongGioOT, 0)
    expect(kq.tongNgayCongCaKy).toBeCloseTo(sumR, 4)
    expect(kq.tongGioOTCaKy).toBeCloseTo(sumS, 4)
    expect(kq.tongNgayCongCaKy).toBe(2) // A: 1 ngày + 1 nghỉ, B: 1 ngày
  })
})

describe('tinhLaiMotDong — sửa tay ở màn S3', () => {
  // Dòng gốc: My83 thiếu Ra1 → công cụ điền hộ + ép OT=0
  const dongGoc: KetQuaNgay = {
    ngay: '2026-08-05',
    thu: '',
    capVaoRa: [{ vao: '06:53', ra: '11:30' }, { vao: '13:34', ra: '18:05' }],
    nguonGoc: ['06:53', null, '13:34', '18:05', null, null],
    gioLamQ: 9.15,
    ngayCongR: 1,
    gioOtS: 0,
    daSua: true,
    ghiChuSua: 'thiếu giờ ra buổi sáng, điền theo ngày kề, ép OT = 0',
    mucDoCanhBao: 'vang'
  }

  it('người dùng điền đủ 4 mốc THẬT → gỡ cờ, OT tính lại theo công thức', () => {
    const r = tinhLaiMotDong(
      dongGoc,
      [{ vao: '06:53', ra: '11:19' }, { vao: '13:34', ra: '18:05' }],
      8.1
    )
    expect(r.gioLamQ).toBeCloseTo(8.95, 3)
    expect(r.ngayCongR).toBe(1)
    expect(r.gioOtS).toBeCloseTo(0.85, 3) // từ 0 → 0.85 sau khi chữa xong dòng
  })

  it('người dùng mới sửa 1 cặp, CHƯA đủ 4 mốc thật → OT vẫn bị ép 0', () => {
    const r = tinhLaiMotDong(dongGoc, [{ vao: '07:00', ra: '11:19' }], 8.1)
    expect(r.gioOtS).toBe(0)
    expect(r.mucDoCanhBao).toBe('vang')
  })

  it('dòng không phải loại bị ép OT → sửa tay vẫn cho OT theo công thức', () => {
    const binhThuong: KetQuaNgay = {
      ...dongGoc,
      capVaoRa: [{ vao: '07:00', ra: '11:30' }, { vao: '13:30', ra: '17:30' }],
      nguonGoc: ['07:00', '11:30', '13:30', '17:30', null, null],
      gioLamQ: 8,
      gioOtS: 0,
      daSua: false,
      ghiChuSua: '',
      mucDoCanhBao: 'none'
    }
    const r = tinhLaiMotDong(binhThuong, [{ vao: '07:00', ra: '11:30' }, { vao: '13:30', ra: '19:00' }], 8.1)
    expect(r.gioLamQ).toBeCloseTo(10, 4)
    expect(r.gioOtS).toBeCloseTo(1.9, 4)
    expect(r.daSua).toBe(true)
  })
})

describe('tinhLaiMotDong — vòng 10 pha E: dời giờ máy sang đúng khe vẫn gỡ được cờ ép OT', () => {
  // Phản hồi dùng thật 2026-09-30: "đang ko sửa dc giờ OT nữa". Ngày 11:36 · 13:29 · 17:40 máy
  // ghi ở cột 1–3; người dùng dời về đúng khe (thêm vào sáng 07:00) — 17:40 nằm ở ô "ra chiều"
  // nhưng máy ghi ở cột 3, luật cũ so đúng vị trí nên coi là mốc công cụ → OT kẹt 0.
  const dong3: KetQuaNgay = {
    ngay: '2026-09-12',
    thu: '',
    capVaoRa: [{ vao: '11:36', ra: '13:29' }, { vao: '13:30', ra: '17:40' }],
    nguonGoc: ['11:36', '13:29', '17:40', null, null, null],
    gioLamQ: 6,
    ngayCongR: 1,
    gioOtS: 0,
    daSua: true,
    otBiEp: true,
    ghiChuSua: 'thiếu giờ vào buổi chiều, điền theo ngày kề, ép OT = 0',
    mucDoCanhBao: 'vang'
  }
  it('3 giờ máy + 1 giờ người dùng tự gõ → đủ 4 mốc thật, OT tính lại', () => {
    const r = tinhLaiMotDong(dong3, [{ vao: '06:30', ra: '11:36' }, { vao: '13:29', ra: '17:40' }], 8.1)
    expect(r.otBiEp).toBe(false)
    expect(r.gioLamQ).toBeCloseTo(9.2833, 3)
    expect(r.gioOtS).toBeGreaterThan(1)
  })
  it('máy chấm 5 lần: còn giờ cặp 3 chưa đưa vào ô → nhắc; đưa vào ô ra chiều → thôi nhắc', () => {
    const d5: KetQuaNgay = {
      ...dong3,
      capVaoRa: [{ vao: '07:06', ra: '10:49' }, { vao: '13:19', ra: '15:13' }],
      nguonGoc: ['07:06', '10:49', '13:19', '15:13', null, '15:45'],
      otBiEp: false
    }
    const giuNguyen = tinhLaiMotDong(d5, [{ vao: '07:06', ra: '10:49' }, { vao: '13:19', ra: '15:13' }], 8.6)
    expect(giuNguyen.ghiChuSua).toContain('máy còn lần chấm 15:45')
    const daDua = tinhLaiMotDong(d5, [{ vao: '07:06', ra: '10:49' }, { vao: '13:19', ra: '15:45' }], 8.6)
    expect(daDua.ghiChuSua).not.toContain('máy còn lần chấm')
  })
  it('để nguyên ô công cụ điền hộ (không phải giờ máy, không gõ lại) → vẫn ép OT = 0', () => {
    const r = tinhLaiMotDong(dong3, [{ vao: '11:36', ra: '13:29' }, { vao: '13:30', ra: '17:40' }], 8.1)
    expect(r.gioOtS).toBe(0)
  })
})

describe('suaNgayCongTrucTiep — vòng 9 AC-2, sửa thẳng "Ngày công" không qua giờ', () => {
  const dongDuMoc: KetQuaNgay = {
    ngay: '2026-08-05',
    thu: '',
    capVaoRa: [{ vao: '06:53', ra: '11:30' }, { vao: '13:34', ra: '18:05' }],
    nguonGoc: ['06:53', '11:30', '13:34', '18:05', null, null],
    gioLamQ: 9.15,
    ngayCongR: 1,
    gioOtS: 1.05,
    daSua: false,
    ghiChuSua: '',
    mucDoCanhBao: 'none'
  }

  it('đổi ngayCongR theo giá trị chọn, ép gioOtS về 0, giữ nguyên capVaoRa/nguonGoc/gioLamQ', () => {
    const r = suaNgayCongTrucTiep(dongDuMoc, 0.5)
    expect(r.ngayCongR).toBe(0.5)
    expect(r.gioOtS).toBe(0)
    expect(r.capVaoRa).toEqual(dongDuMoc.capVaoRa)
    expect(r.nguonGoc).toEqual(dongDuMoc.nguonGoc)
    expect(r.gioLamQ).toBe(dongDuMoc.gioLamQ)
  })

  it('ép otBiEp=true + daSua=true + ghiChuSua rõ ràng + mucDoCanhBao=vang', () => {
    const r = suaNgayCongTrucTiep(dongDuMoc, 1)
    expect(r.otBiEp).toBe(true)
    expect(r.daSua).toBe(true)
    expect(r.ghiChuSua).toBe('đã sửa Ngày công tay')
    expect(r.mucDoCanhBao).toBe('vang')
  })

  it('cho phép sửa ngày nghỉ cả ngày (không mốc) thành có công', () => {
    const nghi: KetQuaNgay = {
      ...dongDuMoc,
      capVaoRa: [],
      nguonGoc: [null, null, null, null, null, null],
      gioLamQ: 0,
      ngayCongR: 0,
      gioOtS: 0,
      daSua: false,
      ghiChuSua: '',
      mucDoCanhBao: 'none'
    }
    const r = suaNgayCongTrucTiep(nghi, 1)
    expect(r.ngayCongR).toBe(1)
    expect(r.capVaoRa).toEqual([])
    expect(r.nguonGoc).toEqual([null, null, null, null, null, null])
  })

  it('sửa giờ (tinhLaiMotDong) SAU KHI đã sửa Ngày công trực tiếp → ghi đè hoàn toàn kết quả trước đó', () => {
    const daSuaR = suaNgayCongTrucTiep(dongDuMoc, 0)
    expect(daSuaR.ghiChuSua).toBe('đã sửa Ngày công tay')
    const suaGioSauDo = tinhLaiMotDong(
      daSuaR,
      [{ vao: '07:00', ra: '11:30' }, { vao: '13:30', ra: '17:30' }],
      8.1
    )
    expect(suaGioSauDo.ghiChuSua).not.toBe('đã sửa Ngày công tay')
    expect(suaGioSauDo.otBiEp).toBe(false)
    expect(suaGioSauDo.ngayCongR).toBe(1)
  })
})

describe('tinhLaiTongHop — cập nhật tổng sau khi sửa tay', () => {
  it('sửa một dòng làm tăng OT → tổng giờ OT của nhân viên tăng theo', () => {
    const file = fileMay([
      { maNhanVien: 'A', tenMay: 'A', dongNgay: [ngay('2026-08-01', ngayThuong), ngay('2026-08-02', ngayThuong)] }
    ])
    const kq = xuLyKyCong(file, [nv({ maNhanVien: 'A', tenMay: 'A' })])
    const th = kq.tongHop[0]
    expect(th.tongGioOT).toBe(0)

    const kqNgay = [...th.ketQuaNgay]
    kqNgay[0] = tinhLaiMotDong(kqNgay[0], [{ vao: '07:00', ra: '11:30' }, { vao: '13:30', ra: '19:30' }], 8.1)
    const thMoi = tinhLaiTongHop(th, kqNgay)

    expect(thMoi.tongGioOT).toBeCloseTo(2.4, 4) // ngày 1: Q=10.5 → OT 10.5−8.1 = 2.4; ngày 2 vẫn 0
    expect(thMoi.tongNgayCong).toBe(2)
    expect(thMoi.soDongCanXemLai).toBe(1)
  })
})
