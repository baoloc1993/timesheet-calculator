import { useEffect, useRef } from 'react'
import { AppStore, useApp } from './store'
import type { ManHinh } from './store'
import type { HienThi } from '../../preload/api-types'
import {
  bundleIcon,
  HomeFilled,
  HomeRegular,
  ArrowDownloadFilled,
  ArrowDownloadRegular,
  TableFilled,
  TableRegular,
  DocumentTextFilled,
  DocumentTextRegular,
  EditFilled,
  EditRegular,
  CalendarLtrFilled,
  CalendarLtrRegular,
  PersonWarningFilled,
  PersonWarningRegular,
  MoneyFilled,
  MoneyRegular,
  PersonFilled,
  PersonRegular,
  PrintFilled,
  PrintRegular,
  PeopleFilled,
  PeopleRegular,
  DocumentArrowRightFilled,
  DocumentArrowRightRegular
} from '@fluentui/react-icons'
import type { FluentIcon } from '@fluentui/react-icons'
import { BangHienThi } from './components/BangHienThi'
import { S1NapFile } from './screens/S1NapFile'
import { S2BangTongHop } from './screens/S2BangTongHop'
import { S4ChanThieuSetup } from './screens/S4ChanThieuSetup'
import { S5Setup } from './screens/S5Setup'
import { S6Xuat } from './screens/S6Xuat'
import { S7XemCong } from './screens/S7XemCong'
import { S8XemChamCongGoc } from './screens/S8XemChamCongGoc'
import { S9Dashboard } from './screens/S9Dashboard'
import { S10PhatLuong } from './screens/S10PhatLuong'
import { S11BangCongThang } from './screens/S11BangCongThang'
import { S12PhatLuongTungNguoi } from './screens/S12PhatLuongTungNguoi'
import { S13InPhieuLuong } from './screens/S13InPhieuLuong'


// Vòng 10 (C7): icon kiểu danh sách Microsoft To Do — bundleIcon hiện nét Filled khi mục đang
// chọn (aria-current), Regular khi không. Màu theo nhóm qua class .ic-* (theme.css).
const Ic = {
  s9: bundleIcon(HomeFilled, HomeRegular),
  s1: bundleIcon(ArrowDownloadFilled, ArrowDownloadRegular),
  s2: bundleIcon(TableFilled, TableRegular),
  s7: bundleIcon(DocumentTextFilled, DocumentTextRegular),
  s8: bundleIcon(EditFilled, EditRegular),
  s11: bundleIcon(CalendarLtrFilled, CalendarLtrRegular),
  s4: bundleIcon(PersonWarningFilled, PersonWarningRegular),
  s10: bundleIcon(MoneyFilled, MoneyRegular),
  s12: bundleIcon(PersonFilled, PersonRegular),
  s13: bundleIcon(PrintFilled, PrintRegular),
  s5: bundleIcon(PeopleFilled, PeopleRegular),
  s6: bundleIcon(DocumentArrowRightFilled, DocumentArrowRightRegular)
} satisfies Partial<Record<ManHinh, FluentIcon>>

function MucNav({
  id,
  nhan,
  mau,
  className,
  disabled,
  badge,
  badgeTitle,
  onClick
}: {
  id: keyof typeof Ic
  nhan: string
  mau: 'blue' | 'teal' | 'green' | 'muted'
  className?: string
  disabled?: boolean
  badge?: number
  badgeTitle?: string
  onClick: () => void
}) {
  const { manHinh } = useApp()
  const Icon = Ic[id]
  const dangChon = manHinh === id
  // title = nhãn (+ số badge) — còn đọc được khi rail thu thành cột icon (< 1024px)
  const title = badge ? `${nhan} (${badgeTitle ?? badge})` : nhan
  return (
    <button
      className={className}
      aria-current={dangChon}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <Icon className={`ic ic-${mau}`} filled={dangChon} aria-hidden />
      <span className="lbl">{nhan}</span>
      {badge ? (
        <span className="badge" title={badgeTitle}>
          {badge}
        </span>
      ) : null}
    </button>
  )
}

// Nav-rail gộp theo việc. Vòng 7: bỏ mục "Rà dòng
// vàng" (S3) — gộp vào S8, đổi tên "Xem chấm công gốc" → "Giải trình & sửa công".
const KY_HIEN_TAI_SUB: { id: 's2' | 's7' | 's8' | 's11'; nhan: string }[] = [
  { id: 's2', nhan: 'Bảng tổng hợp' },
  { id: 's7', nhan: 'Xem công / bảng lương' },
  { id: 's8', nhan: 'Giải trình & sửa công' },
  { id: 's11', nhan: 'Bảng công cả tháng' }
]
// Vòng 6 — nhóm "Phát lương": S10 danh sách + S12 phát từng người + S13 in phiếu.
const PHAT_LUONG_SUB: { id: 's10' | 's12' | 's13'; nhan: string }[] = [
  { id: 's10', nhan: 'Danh sách' },
  { id: 's12', nhan: 'Phát từng người' },
  { id: 's13', nhan: 'In phiếu' }
]

function Rail() {
  const { di, ky, moInPhieu, moGiaiTrinh } = useApp()
  const coKy = !!ky
  const thieu = ky?.thieuSetup.length ?? 0
  const canXem = ky?.tongDongCanXemLai ?? 0

  return (
    <nav className="rail" aria-label="Điều hướng">
      <MucNav id="s9" nhan="Dashboard" mau="blue" onClick={() => di('s9')} />
      <MucNav id="s1" nhan="Nạp kỳ mới" mau="blue" onClick={() => di('s1')} />

      <div className="rail-group">
        <span className="rail-group-label">Kỳ hiện tại</span>
        {KY_HIEN_TAI_SUB.map((m) => (
          // Vòng 7: S8 không còn khoá theo "đã chọn ai chưa" — chưa có ngữ cảnh thì S8 tự
          // hiện danh sách bấm-tên (khuôn S12), không cần chọn trước ở màn khác (AC-2).
          <MucNav
            key={m.id}
            id={m.id}
            nhan={m.nhan}
            mau="teal"
            className="rail-sub"
            disabled={!coKy}
            badge={m.id === 's8' && canXem > 0 ? canXem : undefined}
            badgeTitle={m.id === 's8' ? `${canXem} dòng đã sửa, cần xem lại` : undefined}
            onClick={() => (m.id === 's8' ? moGiaiTrinh() : di(m.id))}
          />
        ))}
        {coKy && thieu > 0 && (
          <MucNav
            id="s4"
            nhan="Nhân viên chưa khai"
            mau="teal"
            className="rail-sub"
            badge={thieu}
            badgeTitle={`${thieu} nhân viên chưa khai`}
            onClick={() => di('s4')}
          />
        )}
      </div>

      <div className="rail-group">
        <span className="rail-group-label">Phát lương</span>
        {PHAT_LUONG_SUB.map((m) => (
          <MucNav
            key={m.id}
            id={m.id}
            nhan={m.nhan}
            mau="green"
            className="rail-sub"
            onClick={() => (m.id === 's13' ? moInPhieu(null) : di(m.id))}
          />
        ))}
      </div>

      <MucNav id="s5" nhan="Setup nhân viên" mau="muted" onClick={() => di('s5')} />
      <MucNav id="s6" nhan="Xuất Excel" mau="muted" disabled={!coKy} onClick={() => di('s6')} />
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
    case 's11':
      return <S11BangCongThang />
    case 's12':
      return <S12PhatLuongTungNguoi />
    case 's13':
      return <S13InPhieuLuong />
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
      <div className="tb-right">
        <BangHienThi />
        <button className="lien-ket" onClick={() => window.api.moGopY()}>
          Góp ý / báo lỗi
        </button>
      </div>
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

export function App({ hienThiBanDau }: { hienThiBanDau: HienThi }) {
  return (
    <AppStore hienThiBanDau={hienThiBanDau}>
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
