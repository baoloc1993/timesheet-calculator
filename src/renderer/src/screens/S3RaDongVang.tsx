import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import { PageHead } from '../components/PageHead'
import type { KetQuaNgay } from '../../../preload/api-types'

const so2 = (n: number) => Math.round(n * 100) / 100

export function S3RaDongVang() {
  const { ky, maNhanVienDangXem, di, datKy, xemChamCongGoc } = useApp()
  const th = ky?.tongHop.find((t) => t.maNhanVien === maNhanVienDangXem)

  const sap = useMemo(
    () =>
      th
        ? [...th.ketQuaNgay].sort((a, b) => {
            if (a.mucDoCanhBao !== b.mucDoCanhBao) return a.mucDoCanhBao === 'vang' ? -1 : 1
            return a.ngay.localeCompare(b.ngay)
          })
        : [],
    [th]
  )

  if (!th) {
    return (
      <>
        <PageHead crumb="Kỳ hiện tại" title="Rà dòng bất thường" />
        <div className="page-body">
        <div className="card">
          <div className="empty">
            <p>Chọn một nhân viên ở bảng tổng hợp để xem chi tiết.</p>
            <button className="btn primary" onClick={() => di('s2')}>
              Về bảng tổng hợp
            </button>
          </div>
        </div>
        </div>
      </>
    )
  }

  const coVang = sap.some((d) => d.mucDoCanhBao === 'vang')

  return (
    <>
      <PageHead
        crumb="Kỳ hiện tại"
        title={th.tenMay}
        sub={<>chi tiết kỳ {ky!.thang}</>}
        actions={
          <>
            <button className="btn" onClick={() => di('s2')}>
              Xong, quay lại tổng hợp
            </button>
            <button className="btn" onClick={() => xemChamCongGoc(th.maNhanVien)}>
              Xem chấm công gốc để đối chiếu
            </button>
          </>
        }
      />
      <div className="page-body">

      <div className="card">
        {!coVang && (
          <p className="note">
            Không có dòng cần xem lại cho nhân viên này — bảng dưới là toàn bộ ngày trong kỳ.
          </p>
        )}

        <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Vào 1</th>
                <th>Ra 1</th>
                <th>Vào 2</th>
                <th>Ra 2</th>
                <th className="num">Giờ làm</th>
                <th className="num">Ngày công</th>
                <th className="num">Giờ OT</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {sap.map((d) => (
                <DongNgay
                  key={d.ngay}
                  dong={d}
                  maNhanVien={th.maNhanVien}
                  onCapNhat={async () => datKy(await window.api.layKyHienTai())}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Sửa một ô giờ vào/ra rồi rời ô → công cụ tính lại dòng đó ngay.</p>
      </div>
      </div>
    </>
  )
}

function DongNgay({
  dong,
  maNhanVien,
  onCapNhat
}: {
  dong: KetQuaNgay
  maNhanVien: string
  onCapNhat: () => void
}) {
  const [cap, setCap] = useState(() => [
    { vao: dong.capVaoRa[0]?.vao ?? '', ra: dong.capVaoRa[0]?.ra ?? '' },
    { vao: dong.capVaoRa[1]?.vao ?? '', ra: dong.capVaoRa[1]?.ra ?? '' }
  ])
  const [luu, setLuu] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  async function guiSua() {
    setLuu(true)
    setLoi(null)
    try {
      const r = await window.api.tinhLaiNgay({
        maNhanVien,
        ngay: dong.ngay,
        cap: cap.map((c) => ({ vao: c.vao || null, ra: c.ra || null }))
      })
      if (r.ok) onCapNhat()
      else setLoi(r.loi ?? 'Không tính lại được dòng này.')
    } finally {
      setLuu(false)
    }
  }

  const o = (ci: number, k: 'vao' | 'ra') => (
    <input
      className="inline-input"
      aria-label={`${k === 'vao' ? 'Vào' : 'Ra'} ${ci + 1} ngày ${dmy(dong.ngay)}`}
      value={cap[ci][k]}
      disabled={luu}
      onChange={(e) => {
        const moi = cap.map((c) => ({ ...c }))
        moi[ci][k] = e.target.value
        setCap(moi)
      }}
      onBlur={guiSua}
      placeholder="—"
    />
  )

  return (
    <tr className={dong.mucDoCanhBao === 'vang' ? 'fixed' : ''}>
      <td>{dmy(dong.ngay).slice(0, 5)}</td>
      <td>{o(0, 'vao')}</td>
      <td>{o(0, 'ra')}</td>
      <td>{o(1, 'vao')}</td>
      <td>{o(1, 'ra')}</td>
      <td className="num">{so2(dong.gioLamQ)}</td>
      <td className="num">{dong.ngayCongR}</td>
      <td className="num">{so2(dong.gioOtS)}</td>
      <td className="small muted ghichu">
        {loi ? (
          <span className="err">{loi}</span>
        ) : (
          dong.ghiChuSua || (dong.capVaoRa.length === 0 ? 'nghỉ cả ngày' : 'bình thường')
        )}
      </td>
    </tr>
  )
}
