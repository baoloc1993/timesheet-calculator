// migration config.json v1 ↔ v2. BACKWARD-COMPATIBILITY §2: migration nào cũng
// phải có đường xuống; round-trip up→down→up phải giữ NhanVien + AppConfig nguyên vẹn.
import { describe, it, expect } from 'vitest'
import { chayMigration, SCHEMA_VERSION_HIEN_TAI } from '../../src/main/settings/migrations'
import type { NhanVien } from '../../src/core/types'

const nhanVien: NhanVien[] = [
  {
    id: 'u1',
    maNhanVien: '00015',
    tenMay: 'Dung',
    tenBangLuong: 'Ông Dũng',
    nguongGioChuanNgay: 10.6,
    donGiaNgay: 320000,
    donGiaGioOT: 80000,
    an: false
  }
]

describe('migration v1 → v2', () => {
  it('SCHEMA_VERSION_HIEN_TAI = 2', () => {
    expect(SCHEMA_VERSION_HIEN_TAI).toBe(2)
  })

  it('up từ v1: thêm ketQuaKy rỗng, KHÔNG đụng NhanVien / AppConfig', () => {
    const d = {
      nhanVien,
      appConfig: { schemaVersion: 1, thuMucXuatGanNhat: 'D:\\x', kyXuLyGanNhat: '2026-08' }
    }
    const sau = chayMigration(d, 1, 2)
    expect(sau.appConfig.schemaVersion).toBe(2)
    expect(sau.ketQuaKy).toEqual({})
    expect(sau.nhanVien).toEqual(nhanVien)
    expect(sau.appConfig.thuMucXuatGanNhat).toBe('D:\\x')
    expect(sau.appConfig.kyXuLyGanNhat).toBe('2026-08')
  })

  it('down v2 → v1: xoá ketQuaKy, hạ version, giữ NhanVien', () => {
    const d = {
      nhanVien,
      appConfig: { schemaVersion: 2, thuMucXuatGanNhat: '' },
      ketQuaKy: {
        '2026-08': {
          thang: '2026-08',
          ngayLuu: 'x',
          khoangNgay: { tu: '2026-08-01', den: '2026-08-31' },
          dongBang: [],
          khauTru: {},
          daTra: {}
        }
      }
    }
    const sau = chayMigration(d, 2, 1)
    expect(sau.appConfig.schemaVersion).toBe(1)
    expect(sau.ketQuaKy).toEqual({})
    expect(sau.nhanVien).toEqual(nhanVien)
  })

  it('round-trip up → down → up: NhanVien + AppConfig bất biến', () => {
    const goc = { nhanVien, appConfig: { schemaVersion: 1, thuMucXuatGanNhat: 'D:\\out' } }
    const up1 = chayMigration(goc, 1, 2)
    const down = chayMigration(up1, 2, 1)
    const up2 = chayMigration(down, 1, 2)
    expect(up2.nhanVien).toEqual(nhanVien)
    expect(up2.appConfig.thuMucXuatGanNhat).toBe('D:\\out')
    expect(up2.appConfig.schemaVersion).toBe(2)
    expect(up2.ketQuaKy).toEqual({})
  })

  it('v0 → v2 (máy mới) chạy cả 2 bước', () => {
    const sau = chayMigration({ nhanVien: [], appConfig: {} }, 0, 2)
    expect(sau.appConfig.schemaVersion).toBe(2)
    expect(sau.ketQuaKy).toEqual({})
  })

  it('config đã CÓ ketQuaKy → up KHÔNG ghi đè (nếu ghi đè = mất toàn bộ lịch sử kỳ)', () => {
    const kyDaLuu = {
      '2026-07': {
        thang: '2026-07',
        ngayLuu: '2026-08-01T00:00:00.000Z',
        khoangNgay: { tu: '2026-07-01', den: '2026-07-31' },
        dongBang: [
          { maNhanVien: '00015', tenBangLuong: 'Ông Dũng', ngayCong: 24, gioOT: 10, thanhTien: 7_000_000, soDongDaSua: 2 }
        ],
        khauTru: { '00015': 500_000 },
        daTra: { '00015': true }
      }
    }
    const sau = chayMigration({ nhanVien, appConfig: { schemaVersion: 1 }, ketQuaKy: kyDaLuu }, 1, 2)
    expect(sau.appConfig.schemaVersion).toBe(2)
    expect(sau.ketQuaKy).toEqual(kyDaLuu)
    expect(sau.ketQuaKy['2026-07'].khauTru['00015']).toBe(500_000)
    expect(sau.ketQuaKy['2026-07'].daTra['00015']).toBe(true)
  })

  it('up giữ nguyên các khoá appConfig khác (fileMauBangLuongGanNhat, kyXuLyGanNhat)', () => {
    const d = {
      nhanVien,
      appConfig: {
        schemaVersion: 1,
        thuMucXuatGanNhat: 'D:\\out',
        fileMauBangLuongGanNhat: 'D:\\mau.xlsx',
        kyXuLyGanNhat: '2026-08'
      }
    }
    const sau = chayMigration(d, 1, 2)
    expect(sau.appConfig).toMatchObject({
      schemaVersion: 2,
      thuMucXuatGanNhat: 'D:\\out',
      fileMauBangLuongGanNhat: 'D:\\mau.xlsx',
      kyXuLyGanNhat: '2026-08'
    })
  })

  it('down v2 → v1 giữ NhanVien + đơn giá + ngưỡng giờ từng người y nguyên', () => {
    const d = {
      nhanVien,
      appConfig: { schemaVersion: 2, thuMucXuatGanNhat: 'D:\\x' },
      ketQuaKy: {
        '2026-08': {
          thang: '2026-08',
          ngayLuu: 'x',
          khoangNgay: { tu: '2026-08-01', den: '2026-08-31' },
          dongBang: [],
          khauTru: {},
          daTra: {}
        }
      }
    }
    const sau = chayMigration(d, 2, 1)
    expect(sau.nhanVien[0].donGiaNgay).toBe(320000)
    expect(sau.nhanVien[0].donGiaGioOT).toBe(80000)
    expect(sau.nhanVien[0].nguongGioChuanNgay).toBe(10.6)
    expect(sau.appConfig.thuMucXuatGanNhat).toBe('D:\\x')
  })

  it('round-trip up→down→up giữ nguyên ketQuaKy đã có (không nhân đôi, không mất)', () => {
    const kyDaLuu = {
      '2026-07': {
        thang: '2026-07',
        ngayLuu: 'x',
        khoangNgay: { tu: '2026-07-01', den: '2026-07-31' },
        dongBang: [
          { maNhanVien: '00015', tenBangLuong: 'Ông Dũng', ngayCong: 24, gioOT: 10, thanhTien: 7_000_000, soDongDaSua: 2 }
        ],
        khauTru: { '00015': 500_000 },
        daTra: { '00015': true }
      }
    }
    const up1 = chayMigration({ nhanVien, appConfig: { schemaVersion: 1 }, ketQuaKy: kyDaLuu }, 1, 2)
    // down xoá ketQuaKy (bản 0.2.0 không đọc) — đây là hành vi đã chốt, .bak là lưới an toàn.
    const down = chayMigration(up1, 2, 1)
    expect(down.ketQuaKy).toEqual({})
    // up lại từ config còn giữ ketQuaKy (rollback bằng .bak, không phải bằng down)
    const up2 = chayMigration({ nhanVien, appConfig: { schemaVersion: 1 }, ketQuaKy: kyDaLuu }, 1, 2)
    expect(up2.ketQuaKy).toEqual(kyDaLuu)
  })
})
