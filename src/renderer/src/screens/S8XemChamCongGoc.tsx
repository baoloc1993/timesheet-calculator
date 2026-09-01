import { useMemo } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import type { KetQuaNgay } from '../../../preload/api-types'

const so2 = (n: number) => Math.round(n * 100) / 100

/** Gộp mảng mốc "HH:MM"/null thành "07:07 | 11:40 | 13:30 | 17:30". Rỗng → "—". */
function mocChuoi(moc: (string | null)[]): string {
  const co = moc.filter((m): m is string => !!m)
  return co.length ? co.join('  |  ') : '—'
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

/** Mốc hiện tại có khác mốc máy gốc ở khe nào không (cùng luật ghiChiTietDaLamSach). */
function khacGoc(kq: KetQuaNgay): boolean {
  const cur = phang4(kq)
  for (let k = 0; k < 4; k++) {
    const g = kq.nguonGoc[k] ?? null
    const c = cur[k]
    if ((g == null) !== (c == null) || (g != null && c != null && g !== c)) return true
  }
  return false
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
        <h1>Xem chấm công gốc</h1>
        <div className="card">
          <div className="empty">
            <p>Chọn một nhân viên ở màn Xem công để đối chiếu chấm công gốc.</p>
            <button className="btn primary" onClick={() => di(ky ? 's7' : 's1')}>
              {ky ? 'Sang Xem công' : 'Sang màn Nạp file'}
            </button>
          </div>
        </div>
      </>
    )
  }

  const tenHienThi = th.tenBangLuong || th.tenMay

  return (
    <>
      <h1>
        {tenHienThi}{' '}
        <span className="sub">chấm công gốc so với số công cụ đã dựng · kỳ {ky.thang}</span>
      </h1>

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
                  const nghi = d.capVaoRa.length === 0 && mocChuoi(d.nguonGoc) === '—'
                  const lech = d.daSua || khacGoc(d)
                  return (
                    <tr key={d.ngay} className={nghi ? 'rest' : ''}>
                      <td>{dmy(d.ngay).slice(0, 5)}</td>
                      <td className="orig">{mocChuoi(d.nguonGoc)}</td>
                      <td className={lech ? 'cell-fixed' : ''}>{mocChuoi(phang4(d))}</td>
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
    </>
  )
}
