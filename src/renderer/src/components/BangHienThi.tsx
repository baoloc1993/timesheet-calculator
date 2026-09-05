import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import type { HienThi } from '../../../preload/api-types'

// C15 — bảng chọn "Hiển thị" (vòng 4, AC-2). Titlebar, mọi màn.
// Nguồn: context/DESIGN-SYSTEM.md §4 (C15) + §2.5.

const CO_CHU: [HienThi['scale'], string][] = [
  [1, '100%'],
  [1.15, '115%'],
  [1.3, '130%']
]
const DO_CAO_HANG: [HienThi['rowHeight'], string][] = [
  [42, 'Gọn'],
  [52, 'Vừa'],
  [64, 'Thưa']
]
const NEN: [HienThi['theme'], string][] = [
  ['light', 'Sáng'],
  ['dark', 'Tối'],
  ['auto', 'Theo Windows']
]
const TUONG_PHAN: [HienThi['contrast'], string][] = [
  ['normal', 'Bình thường'],
  ['high', 'Cao']
]

function Hang<T extends string | number>({
  nhan,
  gia,
  hienTai,
  onChon
}: {
  nhan: string
  gia: [T, string][]
  hienTai: T
  onChon: (v: T) => void
}) {
  return (
    <div className="disp-row">
      <span className="k">{nhan}</span>
      <div className="seg" role="group" aria-label={nhan}>
        {gia.map(([v, ten]) => (
          <button key={v} aria-pressed={hienTai === v} onClick={() => onChon(v)}>
            {ten}
          </button>
        ))}
      </div>
    </div>
  )
}

export function BangHienThi() {
  const { hienThi, capNhatHienThi } = useApp()
  const [mo, setMo] = useState(false)
  const [loi, setLoi] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mo) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMo(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [mo])

  async function apDung(patch: Partial<HienThi>) {
    try {
      setLoi(false)
      await capNhatHienThi(patch)
    } catch {
      setLoi(true)
    }
  }

  return (
    <div className="popwrap" ref={wrapRef}>
      <button
        id="disp-btn"
        className="btn small"
        aria-expanded={mo}
        aria-controls="disp-pop"
        onClick={() => setMo((v) => !v)}
      >
        Hiển thị ▾
      </button>
      {mo && (
        <div className="disp-pop" id="disp-pop" role="dialog" aria-label="Thiết lập hiển thị">
          <Hang nhan="Cỡ chữ" gia={CO_CHU} hienTai={hienThi.scale} onChon={(v) => apDung({ scale: v })} />
          <Hang
            nhan="Độ cao hàng"
            gia={DO_CAO_HANG}
            hienTai={hienThi.rowHeight}
            onChon={(v) => apDung({ rowHeight: v })}
          />
          <Hang nhan="Nền" gia={NEN} hienTai={hienThi.theme} onChon={(v) => apDung({ theme: v })} />
          <Hang
            nhan="Tương phản"
            gia={TUONG_PHAN}
            hienTai={hienThi.contrast}
            onChon={(v) => apDung({ contrast: v })}
          />
          {loi ? (
            <p className="note" role="status" style={{ margin: 0, color: 'var(--color-danger)' }}>
              Không lưu được lựa chọn này — thử bấm lại. Nếu vẫn vậy, kiểm tra quyền ghi file cấu hình.
            </p>
          ) : (
            <p className="note" style={{ margin: 0 }}>
              Áp ngay toàn app, nhớ cho lần mở sau.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
