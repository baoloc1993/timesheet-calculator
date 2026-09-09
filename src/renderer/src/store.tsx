import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { NhanVien, KetQuaKyCong, KetQuaKy, TrangThaiApp, HienThi } from '../../preload/api-types'
import { apDungHienThi } from './hienThi'

export type ManHinh =
  | 's1'
  | 's2'
  | 's4'
  | 's5'
  | 's6'
  | 's7'
  | 's8'
  | 's9'
  | 's10'
  | 's11'
  | 's12'
  | 's13'

interface AppState {
  manHinh: ManHinh
  di(m: ManHinh): void
  trangThai: TrangThaiApp | null
  nhanVien: NhanVien[]
  ky: KetQuaKyCong | null
  fileMay: string
  maNhanVienDangXem: string | null
  /** Bấm tên nhân viên (S2/S7/S9/S11) → S8 "Giải trình & sửa công" (vòng 7, gộp từ S3). */
  xemChamCongGoc(ma: string): void
  /** Vào S8 từ mục nav-rail riêng (chưa có ngữ cảnh người) — quên người đang xem trước đó,
   *  để S8 tự hiện danh sách bấm-tên. */
  moGiaiTrinh(): void
  datKy(k: KetQuaKyCong | null, fileMay?: string): void
  lamMoiTrangThai(): Promise<void>
  lamMoiNhanVien(): Promise<void>
  // Vòng 3
  danhSachKy: KetQuaKy[]
  lamMoiDanhSachKy(): Promise<void>
  /** `thang` của kỳ đang mở ở S9/S10 — null nghĩa là đang xem kỳ hiện tại (chưa lưu). */
  thangDangXem: string | null
  moKy(thang: string | null): void
  /** Vòng 6 — mã nhân viên cần in riêng ở S13 (từ nút "In phiếu cho người này" ở S12).
   *  null = in theo bộ lọc Tất cả/Chỉ người chưa nhận thay vì một người. */
  inPhieuMa: string | null
  moInPhieu(maNhanVien: string | null): void
  // Vòng 4
  hienThi: HienThi
  capNhatHienThi(patch: Partial<HienThi>): Promise<void>
  // Vòng 7 — tự động nạp/đồng bộ nguồn gần nhất khi mở app (AC-1)
  /** != null khi tự động nạp/đồng bộ lúc mở app thất bại — S9 hiện banner nhẹ. */
  tuDongNapLoi: string | null
  /** != null khi tự động đồng bộ THÀNH CÔNG nhưng có cảnh báo dữ liệu (mốc dư bị bỏ…) —
   *  cùng cảnh báo mà luồng tay (S1) đòi xác nhận, nhưng tự động thì không chặn để hỏi. */
  tuDongNapCanhBao: string[] | null
}

const Ctx = createContext<AppState | null>(null)

export function AppStore({
  children,
  hienThiBanDau
}: {
  children: ReactNode
  hienThiBanDau: HienThi
}) {
  const [manHinh, setManHinh] = useState<ManHinh>('s9')
  const [hienThi, setHienThi] = useState<HienThi>(hienThiBanDau)
  const [trangThai, setTrangThai] = useState<TrangThaiApp | null>(null)
  const [nhanVien, setNhanVien] = useState<NhanVien[]>([])
  const [ky, setKy] = useState<KetQuaKyCong | null>(null)
  const [fileMay, setFileMay] = useState('')
  const [maNhanVienDangXem, setMa] = useState<string | null>(null)
  const [danhSachKy, setDanhSachKy] = useState<KetQuaKy[]>([])
  const [thangDangXem, setThangDangXem] = useState<string | null>(null)
  const [inPhieuMa, setInPhieuMa] = useState<string | null>(null)
  const [tuDongNapLoi, setTuDongNapLoi] = useState<string | null>(null)
  const [tuDongNapCanhBao, setTuDongNapCanhBao] = useState<string[] | null>(null)

  const lamMoiTrangThai = useCallback(async () => {
    setTrangThai(await window.api.layTrangThai())
  }, [])
  const lamMoiNhanVien = useCallback(async () => {
    setNhanVien(await window.api.layNhanVien())
  }, [])
  const lamMoiDanhSachKy = useCallback(async () => {
    setDanhSachKy(await window.api.danhSachKy())
  }, [])

  useEffect(() => {
    lamMoiTrangThai()
    lamMoiNhanVien()
    lamMoiDanhSachKy()
  }, [lamMoiTrangThai, lamMoiNhanVien, lamMoiDanhSachKy])

  // Đánh dấu "đã có một kỳ được nạp/đồng bộ (tay hoặc tự động)" — đọc được giá trị MỚI
  // NHẤT bất kể closure cũ nào đang chạy dở (khác `ky` state, chỉ đúng tại thời điểm effect
  // tạo ra). Dùng để chặn race TOCTOU giữa auto-nap (AC-1) và người dùng tự tay nạp trong
  // lúc auto-nap còn đang chờ IPC (soi bug pha P vòng 7).
  const daNapKyRef = useRef(false)

  const datKy = useCallback((k: KetQuaKyCong | null, fm?: string) => {
    setKy(k)
    if (fm !== undefined) {
      daNapKyRef.current = true
      setFileMay(fm)
      setMa(null) // nạp file khác → thôi bám nhân viên đang xem ở S8 (BH-13)
      setThangDangXem(null) // nạp kỳ mới → dashboard hiện kỳ đang tính, không phải kỳ đã lưu đang chọn
      setTuDongNapLoi(null) // nạp/đồng bộ thành công (tay hoặc tự động) → hết lý do còn banner lỗi cũ
    }
    // Vòng 8 — MỌI lần `ky` đổi (nạp mới, sửa tay ở S8, Setup đổi làm dựng lại kỳ) main đều
    // đã tự ghi xuống đĩa ngay (`luuTuDong()`, không còn "Lưu kỳ này" để đợi bấm). Nạp lại
    // danh sách theo cùng nhịp — khác đi thì thẻ "đang mở" (đọc `ky` sống) và bản đã lưu
    // (đọc `danhSachKy`) lệch số nhau, hiện trùng hai thẻ khác tổng cho cùng một thang.
    if (k) lamMoiDanhSachKy()
  }, [lamMoiDanhSachKy])

  // Vòng 7 (AC-1) — mở app: chưa có kỳ đang mở dở dang → tự chạy lại đúng nguồn nạp/đồng
  // bộ thành công gần nhất, một lần (nền, không chặn UI). An toàn dữ liệu thắng tiện lợi:
  // effect này chỉ chạy lúc mount, lúc đó `ky` luôn null.
  useEffect(() => {
    if (ky) return
    let huy = false
    ;(async () => {
      const nguon = await window.api.layNguonGanNhat()
      if (!nguon || huy) return
      const r = await window.api.tuDongNapNguonGanNhat()
      if (huy) return
      // Trong lúc chờ IPC ở trên, người dùng có thể đã tự tay nạp một kỳ khác qua S1 —
      // kỳ tay luôn thắng, không để kết quả auto-nap đè lên (main đã re-check tương tự,
      // đây là lớp chặn thứ hai phía renderer, phòng trường hợp main trả `ok:true` ngay
      // trước khi renderer kịp gọi tay).
      if (daNapKyRef.current) return
      if (r.ok && r.data) {
        datKy(r.data.ky, r.data.fileMay)
        lamMoiTrangThai()
        if (r.canhBao?.length) setTuDongNapCanhBao(r.canhBao)
      } else {
        setTuDongNapLoi(r.loi ?? 'Không tự nạp/đồng bộ lại được.')
      }
    })()
    return () => {
      huy = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: AppState = {
    manHinh,
    di: setManHinh,
    trangThai,
    nhanVien,
    ky,
    fileMay,
    maNhanVienDangXem,
    xemChamCongGoc: (ma) => {
      setMa(ma)
      setManHinh('s8')
    },
    moGiaiTrinh: () => {
      setMa(null)
      setManHinh('s8')
    },
    datKy,
    lamMoiTrangThai,
    lamMoiNhanVien,
    danhSachKy,
    lamMoiDanhSachKy,
    thangDangXem,
    moKy: (thang) => {
      setThangDangXem(thang)
      setManHinh('s9')
    },
    inPhieuMa,
    moInPhieu: (ma) => {
      setInPhieuMa(ma)
      setManHinh('s13')
    },
    hienThi,
    capNhatHienThi: async (patch) => {
      const moi = await window.api.capNhatHienThi(patch)
      apDungHienThi(moi)
      setHienThi(moi)
    },
    tuDongNapLoi,
    tuDongNapCanhBao
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp phải nằm trong <AppStore>')
  return v
}
