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
import { phutTrongNgay, gioChuoi } from './time'
import { chuanHoaMa } from './ma'
import { tinhThanhTien } from './tinhThanhTien'

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
  const nc = lam2(tongNgayCong)
  const ot = lam2(tongGioOT)
  return {
    maNhanVien: nv.maNhanVien,
    tenMay: nv.tenMay,
    tenBangLuong: nv.tenBangLuong,
    nguongGioChuanNgay: nv.nguongGioChuanNgay,
    donGiaNgay: nv.donGiaNgay,
    donGiaGioOT: nv.donGiaGioOT,
    tongNgayCong: nc,
    tongGioOT: ot,
    soDongCanXemLai,
    thanhTien: tinhThanhTien(nc, ot, nv.donGiaNgay, nv.donGiaGioOT),
    ketQuaNgay
  }
}

/** Tổng toàn kỳ từ danh sách tổng hợp nhân viên — một chỗ duy nhất. */
export function tongToanKy(tongHop: TongHopNhanVien[]): {
  tongNgayCongCaKy: number
  tongGioOTCaKy: number
  tongDongCanXemLai: number
  tongThanhTienCaKy: number
} {
  return {
    tongNgayCongCaKy: lam2(tongHop.reduce((s, t) => s + t.tongNgayCong, 0)),
    tongGioOTCaKy: lam2(tongHop.reduce((s, t) => s + t.tongGioOT, 0)),
    tongDongCanXemLai: tongHop.reduce((s, t) => s + t.soDongCanXemLai, 0),
    tongThanhTienCaKy: tongHop.reduce((s, t) => s + t.thanhTien, 0)
  }
}

/**
 * Xử lý cả kỳ. Nhân viên trong file máy chưa khai Setup → đưa vào `thieuSetup`
 * và KHÔNG tính (AC-6). Ghép theo maNhanVien.
 */
export function xuLyKyCong(file: FileMayDaDoc, nhanVienList: NhanVien[]): KetQuaKyCong {
  const theoMa = new Map(nhanVienList.map((n) => [chuanHoaMa(n.maNhanVien), n]))
  const thieuSetup: KetQuaKyCong['thieuSetup'] = []
  const tongHop: TongHopNhanVien[] = []

  for (const khoi of file.khoi) {
    const nv = theoMa.get(chuanHoaMa(khoi.maNhanVien))
    if (!nv) {
      thieuSetup.push({ maNhanVien: khoi.maNhanVien, tenMay: khoi.tenMay })
      continue
    }
    if (nv.an) continue // nhân viên đã ẩn → không tính, không báo thiếu
    const ketQuaNgay = tinhKetQuaNhanVien(khoi.dongNgay, nv.nguongGioChuanNgay)
    tongHop.push(tongHopTuKetQua(nv, ketQuaNgay))
  }

  return {
    thang: file.thang,
    ngayBatDau: file.ngayBatDau,
    ngayKetThuc: file.ngayKetThuc,
    thieuSetup,
    tongHop,
    ...tongToanKy(tongHop)
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
  const phang = [cap[0]?.vao ?? null, cap[0]?.ra ?? null, cap[1]?.vao ?? null, cap[1]?.ra ?? null]
  const toolPhang = [
    dong.capVaoRa[0]?.vao ?? null,
    dong.capVaoRa[0]?.ra ?? null,
    dong.capVaoRa[1]?.vao ?? null,
    dong.capVaoRa[1]?.ra ?? null
  ]

  // Một mốc là "thật" (người dùng làm chủ) khi: có giá trị, VÀ (máy có ghi đúng giờ đó ở BẤT
  // KỲ cột nào trong ngày, HOẶC người dùng vừa gõ khác giá trị công cụ điền hộ). Để trống ô
  // công cụ điền = vẫn là mốc công cụ, chưa thật.
  // Vòng 10 pha E: trước so theo ĐÚNG VỊ TRÍ cột — người dùng dời giờ máy sang khe đúng (VD
  // 17:40 máy ghi ở cột 3 → ô "ra chiều") vẫn bị coi là mốc công cụ, OT kẹt 0 không gỡ được.
  const mocMay = new Set(dong.nguonGoc.map(phutTrongNgay).filter((p): p is number => p != null))
  const mocThat = (k: number): boolean => {
    const moi = phutTrongNgay(phang[k])
    if (moi == null) return false
    if (mocMay.has(moi)) return true
    return moi !== phutTrongNgay(toolPhang[k])
  }
  const du4MocThat = cap.length === 2 && [0, 1, 2, 3].every(mocThat)

  // Sửa tay có tạo ra ca vô lý không → giữ ép OT = 0 + cảnh báo.
  const capPhut = cap.map((c) => ({ v: phutTrongNgay(c.vao), r: phutTrongNgay(c.ra) }))
  const caVoLy = capPhut.some((c) => c.v != null && c.r != null && c.r <= c.v)

  // Vòng 10 pha E: máy ghi > 4 lần chấm thì luôn dư ít nhất 1 giờ ngoài 4 ô — chỉ nhắc khi người
  // dùng CHƯA đổi ô nào so với công cụ dựng; đã sửa 4 ô ngày đó = đã kiểm, thôi nhắc.
  const oChot = new Set(phang.map(phutTrongNgay).filter((p): p is number => p != null))
  const conSot = [...mocMay].filter((p) => !oChot.has(p))
  const chuaDoi = [0, 1, 2, 3].every((k) => phutTrongNgay(phang[k]) === phutTrongNgay(toolPhang[k]))
  const co3 = mocMay.size > 4 && conSot.length > 0 && chuaDoi
  const otBiEp = (dong.otBiEp && !du4MocThat) || caVoLy

  const Q = tinhQ(cap)
  const R = tinhR(Q)
  const S = tinhS(Q, nguongGioChuanNgay, otBiEp || Q > 14)

  let khacGoc = false
  for (let k = 0; k < 4; k++) {
    const g = phutTrongNgay(dong.nguonGoc[k])
    const d = phutTrongNgay(phang[k])
    if ((g == null) !== (d == null) || (g != null && d != null && g !== d)) khacGoc = true
  }
  const daSua = khacGoc || otBiEp || Q > 14 || co3

  const ghiChu: string[] = []
  if (khacGoc) ghiChu.push('người dùng sửa tay')
  if (caVoLy) ghiChu.push('ca vô lý (ra ≤ vào), ép OT = 0 — kiểm lại giờ')
  else if (otBiEp) ghiChu.push('vẫn ép OT = 0 (chưa đủ 4 mốc thật)')
  else if (Q > 14) ghiChu.push(`ca dài bất thường (${Q.toFixed(1)}h), không tính OT`)
  if (co3) ghiChu.push(`máy còn lần chấm ${conSot.map(gioChuoi).join(', ')} chưa đưa vào giờ làm — kiểm lại`)

  return {
    ...dong,
    capVaoRa: cap,
    gioLamQ: Math.round(Q * 10000) / 10000,
    ngayCongR: R,
    gioOtS: S,
    daSua,
    otBiEp,
    ghiChuSua: daSua ? ghiChu.join('; ') || dong.ghiChuSua || 'người dùng sửa tay' : '',
    mucDoCanhBao: daSua ? 'vang' : 'none'
  }
}

/**
 * Vòng 9 — sửa thẳng "Ngày công" (R) một ngày, không qua giờ (AC-2). Ép giờ OT (S) về 0
 * (tái dùng ý nghĩa cờ `otBiEp` đã có — "S đã bị ép về 0"), giữ nguyên `capVaoRa`/`nguonGoc`/
 * `gioLamQ` để S8 tiếp tục hiển thị mốc giờ gốc cạnh số đã sửa (người dùng chốt qua chat
 * 2026-09-09: không xoá/khoá mốc giờ). Sửa giờ sau đó (`tinhLaiMotDong`) tính lại đầy đủ,
 * ghi đè hoàn toàn kết quả hàm này — ai sửa sau có hiệu lực.
 */
export function suaNgayCongTrucTiep(dong: KetQuaNgay, r: 0 | 0.5 | 1): KetQuaNgay {
  return {
    ...dong,
    ngayCongR: r,
    gioOtS: 0,
    otBiEp: true,
    daSua: true,
    ghiChuSua: 'đã sửa Ngày công tay',
    mucDoCanhBao: 'vang'
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
