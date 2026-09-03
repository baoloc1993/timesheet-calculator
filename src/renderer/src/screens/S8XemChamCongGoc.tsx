import { useMemo } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import { PageHead } from '../components/PageHead'
import type { KetQuaNgay } from '../../../preload/api-types'

const so2 = (n: number) => Math.round(n * 100) / 100

/** 4 khe cố định "HH:MM"/"–" (vào1 · ra1 · vào2 · ra2) — căn theo khe để thấy khe nào lệch. */
function khe4(moc: (string | null)[]): string {
  return [0, 1, 2, 3].map((k) => moc[k] || '–').join('  ·  ')
}

/** 4 khe hiện tại từ capVaoRa (vào1, ra1, vào2, ra2). */
function phang4(kq: KetQuaNgay): (string | null)[] {
  return [
    kq.capVaoRa[0]?.vao ?? null,
    kq.capVaoRa[0]?.ra ?? null,
    kq.capVaoRa[1]?.vao ?? null,
    kq.capVaoRa[1]?.ra ?? null
  ]
}

function ghiChu(kq: KetQuaNgay): string {
  if (kq.ghiChuSua) return kq.ghiChuSua
  if (kq.capVaoRa.length === 0) return 'nghỉ cả ngày'
  if (kq.capVaoRa.length === 1)
    return kq.ngayCongR === 1
      ? 'chấm một cặp vào/ra — tính cả ngày (phủ trưa), không tính OT'
      : 'chấm một cặp vào/ra — nửa công, không tính OT'
  return 'khớp gốc — công cụ không đụng vào'
}

export function S8XemChamCongGoc() {
  const { ky, maNhanVienDangXem, di, chonNhanVien, xemChamCongGoc } = useApp()
  const th = ky?.tongHop.find((t) => t.maNhanVien === maNhanVienDangXem)

  const sap = useMemo(
    () => (th ? [...th.ketQuaNgay].sort((a, b) => a.ngay.localeCompare(b.ngay)) : []),
    [th]
  )

  if (!ky || !th) {
    return (
      <>
        <PageHead crumb="Kỳ hiện tại" title="Xem chấm công gốc" />
        <div className="page-body">
        <div className="card">
          <div className="empty">
            <p>Chọn một nhân viên ở màn Xem công để đối chiếu chấm công gốc.</p>
            <button className="btn primary" onClick={() => di(ky ? 's7' : 's1')}>
              {ky ? 'Sang Xem công' : 'Sang màn Nạp file'}
            </button>
          </div>
        </div>
        </div>
      </>
    )
  }

  const tenHienThi = th.tenBangLuong || th.tenMay

  return (
    <>
      <PageHead
        crumb="Kỳ hiện tại"
        title={tenHienThi}
        sub={<>chấm công gốc so với số công cụ đã dựng · kỳ {ky.thang}</>}
      />
      <div className="page-body">
      <div className="card">
        <div className="toolbar">
          <button className="btn" onClick={() => di('s7')}>
            Quay lại Xem công
          </button>
          <button className="btn" onClick={() => chonNhanVien(th.maNhanVien)}>
            Sang Rà dòng vàng
          </button>
          <select
            className="picker"
            aria-label="Chọn nhân viên khác"
            value={th.maNhanVien}
            onChange={(e) => xemChamCongGoc(e.target.value)}
          >
            {ky.tongHop.map((t) => (
              <option key={t.maNhanVien} value={t.maNhanVien}>
                {t.tenBangLuong || t.tenMay} · {t.tenMay}
              </option>
            ))}
          </select>
        </div>

        {sap.length === 0 ? (
          <div className="empty">
            <p>Nhân viên này không có ngày chấm nào trong kỳ.</p>
          </div>
        ) : (
          <div className="table-wrap wide">
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Mốc máy gốc</th>
                  <th>Mốc hiện tại</th>
                  <th className="num">Giờ làm</th>
                  <th className="num">Ngày công</th>
                  <th className="num">Giờ OT</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {sap.map((d) => {
                  const nghiCaNgay = d.capVaoRa.length === 0 && d.nguonGoc.every((m) => !m)
                  // Tô vàng CÙNG LUẬT ghiChiTietDaLamSach: chỉ khi công cụ/người dùng đã đụng vào
                  // (daSua). Dòng 1 cặp phủ trưa / nửa buổi có daSua=false → không tô, không chip.
                  return (
                    <tr key={d.ngay} className={nghiCaNgay ? 'rest' : ''}>
                      <td>{dmy(d.ngay).slice(0, 5)}</td>
                      <td className="orig">{nghiCaNgay ? '— (không chấm)' : khe4(d.nguonGoc)}</td>
                      <td className={d.daSua ? 'cell-fixed' : nghiCaNgay ? 'rest-day' : ''}>
                        {nghiCaNgay ? '— (không chấm)' : khe4(phang4(d))}
                      </td>
                      <td className="num">{so2(d.gioLamQ)}</td>
                      <td className="num">{d.ngayCongR}</td>
                      <td className="num">{so2(d.gioOtS)}</td>
                      <td className="small muted ghichu">
                        {d.daSua && <span className="chip">đã sửa</span>} {ghiChu(d)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="note">
          Cột Mốc máy gốc là giá trị máy chấm công xuất ra, giữ nguyên để đối chiếu. Ô nền vàng
          là chỗ công cụ đã tự sửa hoặc bạn đã sửa tay ở màn Rà dòng vàng.
        </p>
      </div>
      </div>
    </>
  )
}
