import { useEffect, useRef } from 'react'
import { AppStore, useApp } from './store'
import type { ManHinh } from './store'
import { S1NapFile } from './screens/S1NapFile'
import { S2BangTongHop } from './screens/S2BangTongHop'
import { S3RaDongVang } from './screens/S3RaDongVang'
import { S4ChanThieuSetup } from './screens/S4ChanThieuSetup'
import { S5Setup } from './screens/S5Setup'
import { S6Xuat } from './screens/S6Xuat'
import { S7XemCong } from './screens/S7XemCong'
import { S8XemChamCongGoc } from './screens/S8XemChamCongGoc'
import { S9Dashboard } from './screens/S9Dashboard'
import { S10PhatLuong } from './screens/S10PhatLuong'

// Nav-rail gộp theo việc: 6 mục, nhãn theo việc người dùng.
const KY_HIEN_TAI_SUB: { id: ManHinh; nhan: string }[] = [
  { id: 's2', nhan: 'Bảng tổng hợp' },
  { id: 's3', nhan: 'Rà dòng vàng' },
  { id: 's7', nhan: 'Xem công / bảng lương' },
  { id: 's8', nhan: 'Xem chấm công gốc' }
]

function Rail() {
  const { manHinh, di, ky, maNhanVienDangXem } = useApp()
  const coKy = !!ky
  const thieu = ky?.thieuSetup.length ?? 0
  const canXem = ky?.tongDongCanXemLai ?? 0

  return (
    <nav className="rail" aria-label="Điều hướng">
      <button aria-current={manHinh === 's9'} onClick={() => di('s9')}>
        Dashboard
      </button>
      <button aria-current={manHinh === 's1'} onClick={() => di('s1')}>
        Nạp kỳ mới
      </button>

      <div className="rail-group">
        <span className="rail-group-label">Kỳ hiện tại</span>
        {KY_HIEN_TAI_SUB.map((m) => {
          const khoa = !coKy || (m.id === 's8' && !maNhanVienDangXem)
          return (
            <button
              key={m.id}
              className="rail-sub"
              aria-current={manHinh === m.id}
              disabled={khoa}
              onClick={() => di(m.id)}
            >
              {m.nhan}
              {m.id === 's3' && canXem > 0 && <span className="badge">{canXem}</span>}
            </button>
          )
        })}
        {coKy && thieu > 0 && (
          <button
            className="rail-sub"
            aria-current={manHinh === 's4'}
            onClick={() => di('s4')}
          >
            Nhân viên chưa khai
            <span className="badge">{thieu}</span>
          </button>
        )}
      </div>

      <button aria-current={manHinh === 's10'} onClick={() => di('s10')}>
        Phát lương
      </button>
      <button aria-current={manHinh === 's5'} onClick={() => di('s5')}>
        Setup nhân viên
      </button>
      <button aria-current={manHinh === 's6'} disabled={!coKy} onClick={() => di('s6')}>
        Xuất Excel
      </button>
    </nav>
  )
}

function ManHinhHienTai() {
  const { manHinh } = useApp()
  switch (manHinh) {
    case 's1':
      return <S1NapFile />
    case 's2':
      return <S2BangTongHop />
    case 's3':
      return <S3RaDongVang />
    case 's4':
      return <S4ChanThieuSetup />
    case 's5':
      return <S5Setup />
    case 's6':
      return <S6Xuat />
    case 's7':
      return <S7XemCong />
    case 's8':
      return <S8XemChamCongGoc />
    case 's9':
      return <S9Dashboard />
    case 's10':
      return <S10PhatLuong />
  }
}

function TitleBar() {
  const { ky } = useApp()
  return (
    <div className="titlebar">
      <strong>Timesheet Calculator</strong>
      <span>
        {ky
          ? `— kỳ ${ky.thang} · ${dmy(ky.ngayBatDau)} – ${dmy(ky.ngayKetThuc)}`
          : '— chưa nạp kỳ công'}
      </span>
      <button className="lien-ket" onClick={() => window.api.moGopY()}>
        Góp ý / báo lỗi
      </button>
    </div>
  )
}

export function dmy(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function Noi() {
  const { manHinh, trangThai } = useApp()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.scrollTo(0, 0)
  }, [manHinh])
  return (
    <main className="content" ref={ref}>
      {trangThai?.loiMigration && (
        <div className="errorbox" role="alert" style={{ marginBottom: 'var(--space-lg)' }}>
          <strong>Không nâng cấp được dữ liệu.</strong>
          <p className="small">{trangThai.loiMigration}</p>
        </div>
      )}
      <ManHinhHienTai />
    </main>
  )
}

export function App() {
  return (
    <AppStore>
      <div className="shell">
        <TitleBar />
        <div className="body">
          <Rail />
          <Noi />
        </div>
      </div>
    </AppStore>
  )
}
