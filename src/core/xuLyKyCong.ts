// Orchestrator lõi: file máy đã parse + danh sách NhanVien → kết quả cả kỳ.

import type {
  FileMayDaDoc,
  NhanVien,
  KetQuaKyCong,
  TongHopNhanVien,
  KetQuaNgay,
  DongNgayMay
} from './types'
import { tinhKetQuaNhanVien } from './phatHienBatThuong'
import { tinhQ, tinhR, tinhS } from './tinhQRS'
import { phutTrongNgay } from './time'

const lam2 = (x: number) => Math.round(x * 100) / 100

function tongHopTuKetQua(nv: NhanVien, ketQuaNgay: KetQuaNgay[]): TongHopNhanVien {
  let tongNgayCong = 0
  let tongGioOT = 0
  let soDongCanXemLai = 0
  for (const kq of ketQuaNgay) {
    tongNgayCong += kq.ngayCongR
    tongGioOT += kq.gioOtS
    if (kq.mucDoCanhBao === 'vang') soDongCanXemLai++
  }
  return {
    maNhanVien: nv.maNhanVien,
    tenMay: nv.tenMay,
    tenBangLuong: nv.tenBangLuong,
    nguongGioChuanNgay: nv.nguongGioChuanNgay,
    donGiaNgay: nv.donGiaNgay,
    donGiaGioOT: nv.donGiaGioOT,
    tongNgayCong: lam2(tongNgayCong),
    tongGioOT: lam2(tongGioOT),
    soDongCanXemLai,
    ketQuaNgay
  }
}

/**
 * Xử lý cả kỳ. Nhân viên trong file máy chưa khai Setup → đưa vào `thieuSetup`
 * và KHÔNG tính (AC-6). Ghép theo maNhanVien.
 */
export function xuLyKyCong(file: FileMayDaDoc, nhanVienList: NhanVien[]): KetQuaKyCong {
  const theoMa = new Map(nhanVienList.map((n) => [n.maNhanVien, n]))
  const thieuSetup: KetQuaKyCong['thieuSetup'] = []
  const tongHop: TongHopNhanVien[] = []

  for (const khoi of file.khoi) {
    const nv = theoMa.get(khoi.maNhanVien)
    if (!nv) {
      thieuSetup.push({ maNhanVien: khoi.maNhanVien, tenMay: khoi.tenMay })
      continue
    }
    const ketQuaNgay = tinhKetQuaNhanVien(khoi.dongNgay, nv.nguongGioChuanNgay)
    tongHop.push(tongHopTuKetQua(nv, ketQuaNgay))
  }

  return {
    thang: file.thang,
    ngayBatDau: file.ngayBatDau,
    ngayKetThuc: file.ngayKetThuc,
    thieuSetup,
    tongHop,
    tongNgayCongCaKy: lam2(tongHop.reduce((s, t) => s + t.tongNgayCong, 0)),
    tongGioOTCaKy: lam2(tongHop.reduce((s, t) => s + t.tongGioOT, 0)),
    tongDongCanXemLai: tongHop.reduce((s, t) => s + t.soDongCanXemLai, 0)
  }
}

/**
 * Người dùng sửa tay một ô giờ ở màn S3 → tính lại MỘT dòng của MỘT nhân viên.
 * Cờ "ép S=0 do thiếu chấm" chỉ gỡ khi dòng có đủ 4 mốc thật.
 */
export function tinhLaiMotDong(
  dong: KetQuaNgay,
  capMoi: { vao: string | null; ra: string | null }[],
  nguongGioChuanNgay: number
): KetQuaNgay {
  const cap = capMoi.slice(0, 2).map((c) => ({ vao: c.vao || null, ra: c.ra || null }))
  const du4Moc =
    cap.length === 2 &&
    [cap[0]?.vao, cap[0]?.ra, cap[1]?.vao, cap[1]?.ra].every((m) => phutTrongNgay(m) != null)

  // dòng gốc từng bị ép OT=0 vì thiếu/lộn mốc?
  const tungEpOt =
    dong.daSua && /thiếu|lộn|dựng lại|quên chấm/.test(dong.ghiChuSua)
  const epOtVe0 = tungEpOt && !du4Moc

  const Q = tinhQ(cap)
  const R = tinhR(Q)
  const S = tinhS(Q, nguongGioChuanNgay, epOtVe0)

  // so với nguonGoc để biết còn "đã sửa" không
  const phang = [cap[0]?.vao ?? null, cap[0]?.ra ?? null, cap[1]?.vao ?? null, cap[1]?.ra ?? null]
  let khacGoc = false
  for (let k = 0; k < 4; k++) {
    const g = phutTrongNgay(dong.nguonGoc[k])
    const d = phutTrongNgay(phang[k])
    if ((g == null) !== (d == null) || (g != null && d != null && g !== d)) khacGoc = true
  }
  const daSua = khacGoc || epOtVe0

  return {
    ...dong,
    capVaoRa: cap,
    gioLamQ: Math.round(Q * 10000) / 10000,
    ngayCongR: R,
    gioOtS: S,
    daSua,
    ghiChuSua: daSua
      ? khacGoc
        ? 'người dùng sửa tay' + (epOtVe0 ? '; vẫn ép OT = 0 (chưa đủ 4 mốc thật)' : '')
        : dong.ghiChuSua
      : '',
    mucDoCanhBao: daSua ? 'vang' : 'none'
  }
}

/** Tính lại tổng hợp một nhân viên sau khi sửa tay. */
export function tinhLaiTongHop(
  th: TongHopNhanVien,
  ketQuaNgayMoi: KetQuaNgay[]
): TongHopNhanVien {
  return tongHopTuKetQua(
    {
      id: '',
      maNhanVien: th.maNhanVien,
      tenMay: th.tenMay,
      tenBangLuong: th.tenBangLuong,
      nguongGioChuanNgay: th.nguongGioChuanNgay,
      donGiaNgay: th.donGiaNgay,
      donGiaGioOT: th.donGiaGioOT,
      an: false
    },
    ketQuaNgayMoi
  ) as TongHopNhanVien & { ketQuaNgay: KetQuaNgay[] }
}

export type { DongNgayMay }
