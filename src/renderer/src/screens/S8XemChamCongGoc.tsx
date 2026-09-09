import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import { PageHead } from '../components/PageHead'
import type { KetQuaNgay } from '../../../preload/api-types'

const so2 = (n: number) => Math.round(n * 100) / 100

/** 4 khe cố định "HH:MM"/"–" (vào1 · ra1 · vào2 · ra2) — căn theo khe để thấy khe nào lệch. */
function khe4(moc: (string | null)[]): string {
  return [0, 1, 2, 3].map((k) => moc[k] || '–').join('  ·  ')
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
  const { ky, maNhanVienDangXem, di, xemChamCongGoc, datKy } = useApp()
  const th = ky?.tongHop.find((t) => t.maNhanVien === maNhanVienDangXem)

  // Dòng "cần xem lại" lên đầu trước, rồi mới theo ngày — hành vi gốc của S3 (đã gộp vào
  // đây vòng 7), phục vụ soát nhanh bất thường; đọc theo ngày trong bảng vẫn dễ vì mỗi
  // dòng đều có cột Ngày (soi bug pha P vòng 7 — mất khi gộp, không có chủ đích bỏ).
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

  if (!ky) {
    return (
      <>
        <PageHead crumb="Kỳ hiện tại" title="Giải trình & sửa công" />
        <div className="page-body">
          <div className="card">
            <div className="empty">
              <p>Chưa nạp kỳ công nào — nạp file ở màn Nạp file.</p>
              <button className="btn primary" onClick={() => di('s1')}>
                Sang màn Nạp file
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Vòng 7 (AC-2) — vào từ mục nav mới, chưa có ngữ cảnh người → hiện danh sách bấm-tên
  // trước (cùng khuôn danh sách chọn người ở S12), không phải khuôn "quay lại S2 tự chọn"
  // như hành vi cũ của mục nav S3.
  if (!th) {
    return (
      <>
        <PageHead
          crumb="Kỳ hiện tại"
          title="Giải trình & sửa công"
          sub={<>chọn một người để xem · kỳ {ky.thang}</>}
        />
        <div className="page-body">
          <div className="card">
            {ky.tongHop.length === 0 ? (
              <div className="empty">
                <p>Chưa có nhân viên nào đủ Setup trong kỳ này.</p>
              </div>
            ) : (
              <div className="pick-grid">
                {ky.tongHop.map((t) => (
                  <button
                    key={t.maNhanVien}
                    className={'pick-btn' + (t.soDongCanXemLai > 0 ? ' chan' : '')}
                    onClick={() => xemChamCongGoc(t.maNhanVien)}
                  >
                    <span className="pn">{t.tenBangLuong || t.tenMay}</span>
                    <span className="pm">mã {t.maNhanVien}</span>
                    <span className="pv">
                      {t.soDongCanXemLai > 0 ? `${t.soDongCanXemLai} dòng đã sửa` : 'khớp gốc'}
                    </span>
                  </button>
                ))}
              </div>
            )}
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
        sub={<>giải trình & sửa công · kỳ {ky.thang}</>}
      />
      <div className="page-body">
      <div className="card">
        <div className="toolbar">
          <button className="btn" onClick={() => di('s7')}>
            Quay lại Xem công
          </button>
          <button className="btn" onClick={() => di('s2')}>
            Quay lại tổng hợp
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
                  <th>Mốc hiện tại (sửa được)</th>
                  <th className="num">Giờ làm</th>
                  <th className="num">Ngày công</th>
                  <th className="num">Giờ OT</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {sap.map((d) => (
                  <DongGiaiTrinh
                    key={d.ngay}
                    dong={d}
                    maNhanVien={th.maNhanVien}
                    onCapNhat={async () => datKy(await window.api.layKyHienTai())}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="note">
          Sửa một ô giờ ở cột &quot;Mốc hiện tại&quot; rồi rời ô → công cụ tính lại dòng đó ngay, không
          cần rời màn — đủ rõ để cho công nhân đứng xem và sửa tại chỗ nếu lệch. Ô nền đã sửa
          là chỗ công cụ đã tự sửa hoặc bạn vừa sửa tay ở đây.
        </p>
      </div>
      </div>
    </>
  )
}

function DongGiaiTrinh({
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
  // Vòng 8: sửa xong tự ghi ngay (không còn "Lưu kỳ này") — nháy "✓ đã lưu" 1.5s để người
  // dùng thấy rõ, tránh lo lắng không biết có mất khi tắt app hay không (dogfood newbie).
  const [vuaLuu, setVuaLuu] = useState(false)

  async function guiSua() {
    setLuu(true)
    setLoi(null)
    try {
      const r = await window.api.tinhLaiNgay({
        maNhanVien,
        ngay: dong.ngay,
        cap: cap.map((c) => ({ vao: c.vao || null, ra: c.ra || null }))
      })
      if (r.ok) {
        onCapNhat()
        setVuaLuu(true)
        setTimeout(() => setVuaLuu(false), 1500)
      } else setLoi(r.loi ?? 'Không tính lại được dòng này.')
    } finally {
      setLuu(false)
    }
  }

  // Vòng 9 (AC-2) — sửa thẳng "Ngày công" không qua giờ: mốc giờ ở cột "Mốc hiện tại"
  // giữ nguyên (không đụng `cap`), chỉ ép Giờ OT về 0 + đổi ghi chú (src/core/xuLyKyCong.ts
  // suaNgayCongTrucTiep). Sửa giờ sau đó ghi đè lại bình thường qua guiSua().
  async function guiSuaR(r: 0 | 0.5 | 1) {
    setLuu(true)
    setLoi(null)
    try {
      const res = await window.api.tinhLaiNgay({ maNhanVien, ngay: dong.ngay, r })
      if (res.ok) {
        onCapNhat()
        setVuaLuu(true)
        setTimeout(() => setVuaLuu(false), 1500)
      } else setLoi(res.loi ?? 'Không sửa được Ngày công dòng này.')
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

  const nghiCaNgay = dong.capVaoRa.length === 0 && dong.nguonGoc.every((m) => !m)

  return (
    <tr>
      <td>{dmy(dong.ngay).slice(0, 5)}</td>
      <td className="orig">{nghiCaNgay ? '— (không chấm)' : khe4(dong.nguonGoc)}</td>
      <td className={dong.daSua ? 'cell-fixed' : ''}>
        {o(0, 'vao')}
        {o(0, 'ra')}
        {o(1, 'vao')}
        {o(1, 'ra')}
      </td>
      <td className="num">{so2(dong.gioLamQ)}</td>
      <td className="num">
        <select
          className="inline-input"
          aria-label={`Ngày công ${dmy(dong.ngay)}`}
          value={dong.ngayCongR}
          disabled={luu}
          onChange={(e) => guiSuaR(Number(e.target.value) as 0 | 0.5 | 1)}
        >
          <option value={0}>0</option>
          <option value={0.5}>0.5</option>
          <option value={1}>1</option>
        </select>
      </td>
      <td className="num">{so2(dong.gioOtS)}</td>
      <td className="small muted ghichu">
        {loi ? (
          <span className="err">{loi}</span>
        ) : (
          <>
            {dong.daSua && <span className="chip">đã sửa</span>}{' '}
            {vuaLuu && (
              <span className="chip" style={{ color: 'var(--color-success)' }} role="status">
                ✓ đã lưu
              </span>
            )}{' '}
            {ghiChu(dong)}
          </>
        )}
      </td>
    </tr>
  )
}
