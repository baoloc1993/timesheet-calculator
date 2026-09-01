import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { NhanVien, KetQuaKyCong, TrangThaiApp } from '../../preload/api-types'

export type ManHinh = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8'

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
}

const Ctx = createContext<AppState | null>(null)

export function AppStore({ children }: { children: ReactNode }) {
  const [manHinh, setManHinh] = useState<ManHinh>('s1')
  const [trangThai, setTrangThai] = useState<TrangThaiApp | null>(null)
  const [nhanVien, setNhanVien] = useState<NhanVien[]>([])
  const [ky, setKy] = useState<KetQuaKyCong | null>(null)
  const [fileMay, setFileMay] = useState('')
  const [maNhanVienDangXem, setMa] = useState<string | null>(null)

  const lamMoiTrangThai = useCallback(async () => {
    setTrangThai(await window.api.layTrangThai())
  }, [])
  const lamMoiNhanVien = useCallback(async () => {
    setNhanVien(await window.api.layNhanVien())
  }, [])

  useEffect(() => {
    lamMoiTrangThai()
    lamMoiNhanVien()
  }, [lamMoiTrangThai, lamMoiNhanVien])

  const datKy = useCallback((k: KetQuaKyCong | null, fm?: string) => {
    setKy(k)
    if (fm !== undefined) {
      setFileMay(fm)
      setMa(null) // nạp file khác → thôi bám nhân viên đang xem ở S3/S8 (BH-13)
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
    lamMoiNhanVien
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp phải nằm trong <AppStore>')
  return v
}
