import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { NhanVien, KetQuaKyCong, KetQuaKy, TrangThaiApp, HienThi } from '../../preload/api-types'
import { apDungHienThi } from './hienThi'

export type ManHinh = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9' | 's10'

interface AppState {
  manHinh: ManHinh
  di(m: ManHinh): void
  trangThai: TrangThaiApp | null
  nhanVien: NhanVien[]
  ky: KetQuaKyCong | null
  fileMay: string
  maNhanVienDangXem: string | null
  chonNhanVien(ma: string): void
  xemChamCongGoc(ma: string): void
  datKy(k: KetQuaKyCong | null, fileMay?: string): void
  lamMoiTrangThai(): Promise<void>
  lamMoiNhanVien(): Promise<void>
  // Vòng 3
  danhSachKy: KetQuaKy[]
  lamMoiDanhSachKy(): Promise<void>
  /** `thang` của kỳ đang mở ở S9/S10 — null nghĩa là đang xem kỳ hiện tại (chưa lưu). */
  thangDangXem: string | null
  moKy(thang: string | null): void
  // Vòng 4
  hienThi: HienThi
  capNhatHienThi(patch: Partial<HienThi>): Promise<void>
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

  const datKy = useCallback((k: KetQuaKyCong | null, fm?: string) => {
    setKy(k)
    if (fm !== undefined) {
      setFileMay(fm)
      setMa(null) // nạp file khác → thôi bám nhân viên đang xem ở S3/S8 (BH-13)
      setThangDangXem(null) // nạp kỳ mới → dashboard hiện kỳ đang tính, không phải kỳ đã lưu đang chọn
    }
  }, [])

  const value: AppState = {
    manHinh,
    di: setManHinh,
    trangThai,
    nhanVien,
    ky,
    fileMay,
    maNhanVienDangXem,
    chonNhanVien: (ma) => {
      setMa(ma)
      setManHinh('s3')
    },
    xemChamCongGoc: (ma) => {
      setMa(ma)
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
    hienThi,
    capNhatHienThi: async (patch) => {
      const moi = await window.api.capNhatHienThi(patch)
      apDungHienThi(moi)
      setHienThi(moi)
    }
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp phải nằm trong <AppStore>')
  return v
}
