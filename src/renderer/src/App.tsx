import { AppStore, useApp } from './store'
import type { ManHinh } from './store'
import { S1NapFile } from './screens/S1NapFile'
import { S2BangTongHop } from './screens/S2BangTongHop'
import { S3RaDongVang } from './screens/S3RaDongVang'
import { S4ChanThieuSetup } from './screens/S4ChanThieuSetup'
import { S5Setup } from './screens/S5Setup'
import { S6Xuat } from './screens/S6Xuat'

const MUC: { id: ManHinh; nhan: string }[] = [
  { id: 's1', nhan: 'Nạp file' },
  { id: 's2', nhan: 'Bảng tổng hợp' },
  { id: 's3', nhan: 'Rà dòng vàng' },
  { id: 's4', nhan: 'Chặn: thiếu Setup' },
  { id: 's5', nhan: 'Setup nhân viên' },
  { id: 's6', nhan: 'Xuất kết quả' }
]

function Rail() {
  const { manHinh, di, ky } = useApp()
  const coKy = !!ky
  const thieu = ky?.thieuSetup.length ?? 0
  const canXem = ky?.tongDongCanXemLai ?? 0
  return (
    <nav className="rail" aria-label="Điều hướng">
      {MUC.map((m) => {
        const khoa =
          (!coKy && (m.id === 's2' || m.id === 's3' || m.id === 's4' || m.id === 's6')) ||
          (m.id === 's4' && thieu === 0)
        return (
          <button
            key={m.id}
            aria-current={manHinh === m.id}
            disabled={khoa}
            onClick={() => di(m.id)}
          >
            {m.nhan}
            {m.id === 's4' && thieu > 0 && <span className="badge">{thieu}</span>}
            {m.id === 's3' && canXem > 0 && <span className="badge">{canXem}</span>}
          </button>
        )
      })}
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
    </div>
  )
}

export function dmy(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export function App() {
  return (
    <AppStore>
      <div className="shell">
        <TitleBar />
        <div className="body">
          <Rail />
          <main className="content">
            <ManHinhHienTai />
          </main>
        </div>
      </div>
    </AppStore>
  )
}
