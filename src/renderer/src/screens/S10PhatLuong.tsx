import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import { PageHead } from '../components/PageHead'
import type { KetQuaKy } from '../../../preload/api-types'
import { tinhThucNhan } from '../../../preload/api-types'

const vnd = (n: number) => n.toLocaleString('vi-VN')

export function S10PhatLuong() {
  const { thangDangXem, di, lamMoiDanhSachKy } = useApp()
  const [kq, setKq] = useState<KetQuaKy | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [nhap, setNhap] = useState<Record<string, string>>({})
  const [loiO, setLoiO] = useState<Record<string, string>>({})

  const nap = useCallback(async () => {
    if (!thangDangXem) {
      setKq(null)
      setDangTai(false)
      return
    }
    setDangTai(true)
    const k = await window.api.docKy(thangDangXem)
    setKq(k)
    setNhap(
      Object.fromEntries((k?.dongBang ?? []).map((d) => [d.maNhanVien, String(k!.khauTru[d.maNhanVien] ?? 0)]))
    )
    setDangTai(false)
  }, [thangDangXem])

  useEffect(() => {
    nap()
  }, [nap])

  async function luuKhauTru(ma: string) {
    if (!kq) return
    const raw = (nhap[ma] ?? '').trim().replace(/[.\s]/g, '')
    const so = raw === '' ? 0 : Number(raw)
    if (!Number.isFinite(so) || so < 0) {
      setLoiO((m) => ({ ...m, [ma]: 'Khấu trừ phải là số không âm.' }))
      return
    }
    setLoiO((m) => ({ ...m, [ma]: '' }))
    const r = await window.api.capNhatPhatLuong({ thang: kq.thang, maNhanVien: ma, khauTru: so })
    if (r.ok && r.data) {
      setKq(r.data)
      await lamMoiDanhSachKy()
    } else {
      setLoiO((m) => ({ ...m, [ma]: r.loi ?? 'Không lưu được.' }))
    }
  }

  async function tickDaTra(ma: string, v: boolean) {
    if (!kq) return
    const r = await window.api.capNhatPhatLuong({ thang: kq.thang, maNhanVien: ma, daTra: v })
    if (r.ok && r.data) {
      setKq(r.data)
      await lamMoiDanhSachKy()
    }
  }

  // Khấu trừ "đang hiển thị" = số trong ô nhập nếu hợp lệ, else số đã lưu. Bảng + bản in +
  // tổng đều đọc qua đây → "In danh sách" ngay sau khi gõ (chưa kịp onBlur lưu) vẫn in
  // đúng số (bug-hunter / reviewer: race window.print vs luuKhauTru bất đồng bộ).
  const khauTruHt = useCallback(
    (ma: string): number => {
      const raw = nhap[ma]
      if (raw !== undefined) {
        const s = raw.trim().replace(/[.\s]/g, '')
        const n = s === '' ? 0 : Number(s)
        if (Number.isFinite(n) && n >= 0) return Math.round(n)
      }
      return kq?.khauTru[ma] ?? 0
    },
    [nhap, kq]
  )

  const tong = useMemo(() => {
    if (!kq) return { tienMat: 0, chuaNhan: 0, daPhat: 0 }
    let tienMat = 0
    let chuaNhan = 0
    let daPhat = 0
    for (const d of kq.dongBang) {
      tienMat += tinhThucNhan(d.thanhTien, khauTruHt(d.maNhanVien))
      if (kq.daTra[d.maNhanVien] === true) daPhat++
      else chuaNhan++
    }
    return { tienMat, chuaNhan, daPhat }
  }, [kq, khauTruHt])

  if (!thangDangXem) {
    return (
      <>
        <PageHead title="Phát lương" />
        <div className="page-body">
        <div className="card">
          <div className="empty">
            <p>Chọn một kỳ đã lưu ở Dashboard, hoặc lưu kỳ đang tính trước.</p>
            <button className="btn primary" onClick={() => di('s9')}>
              Về Dashboard
            </button>
          </div>
        </div>
        </div>
      </>
    )
  }

  if (dangTai) {
    return (
      <>
        <PageHead title="Phát lương" />
        <div className="page-body">
        <p className="loading">Đang tải kỳ…</p>
        </div>
      </>
    )
  }

  if (!kq) {
    return (
      <>
        <PageHead title="Phát lương" />
        <div className="page-body">
        <div className="card">
          <div className="empty">
            <p>Không tìm thấy kỳ {thangDangXem} đã lưu.</p>
            <button className="btn primary" onClick={() => di('s9')}>
              Về Dashboard
            </button>
          </div>
        </div>
        </div>
      </>
    )
  }

  const M = kq.dongBang.length

  return (
    <>
      <PageHead
        title="Phát lương"
        sub={
          <>
            kỳ {kq.thang} · {dmy(kq.khoangNgay.tu)} – {dmy(kq.khoangNgay.den)}
          </>
        }
        actions={
          <>
            <button
              className="btn primary"
              onClick={() => {
                // Ép commit ô đang gõ (onBlur) trước khi in — bản in đọc state, không phải DOM.
                const el = document.activeElement as HTMLElement | null
                el?.blur()
                window.api.danhDauInDanhSach({ thang: kq.thang, soNguoi: kq.dongBang.length })
                window.print()
              }}
            >
              In danh sách
            </button>
            <button className="btn" onClick={() => di('s9')}>
              Về Dashboard
            </button>
          </>
        }
      />
      <div className="page-body">

      <div className="stats">
        <div className="stat">
          <div className="num">{vnd(tong.tienMat)}</div>
          <div className="label">Tổng tiền mặt phải phát (VND)</div>
        </div>
        <div className="stat">
          <div className={'num' + (tong.chuaNhan > 0 ? ' alert' : '')}>{tong.chuaNhan}</div>
          <div className="label">Còn người chưa nhận</div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th className="num">Thành tiền</th>
                <th className="num">Tạm ứng / khấu trừ</th>
                <th className="num">Thực nhận</th>
                <th>Đã trả</th>
              </tr>
            </thead>
            <tbody>
              {kq.dongBang.map((d) => {
                const kt = khauTruHt(d.maNhanVien)
                const tn = tinhThucNhan(d.thanhTien, kt)
                const daTra = kq.daTra[d.maNhanVien] === true
                return (
                  <tr key={d.maNhanVien} className={daTra ? 'da-tra' : ''}>
                    <td>{d.tenBangLuong}</td>
                    <td className="num">{vnd(d.thanhTien)}</td>
                    <td className="num">
                      <input
                        className={'inline-input' + (loiO[d.maNhanVien] ? ' loi' : '')}
                        style={{ textAlign: 'right', width: 110 }}
                        inputMode="numeric"
                        value={nhap[d.maNhanVien] ?? ''}
                        onChange={(e) =>
                          setNhap((m) => ({ ...m, [d.maNhanVien]: e.target.value }))
                        }
                        onBlur={() => luuKhauTru(d.maNhanVien)}
                        aria-label={`Khấu trừ của ${d.tenBangLuong}`}
                      />
                      {loiO[d.maNhanVien] && (
                        <div className="err small">{loiO[d.maNhanVien]}</div>
                      )}
                    </td>
                    <td className={'num tiennhan' + (tn < 0 ? ' am' : '')}>{vnd(tn)}</td>
                    <td>
                      <label className="checkwrap">
                        <input
                          type="checkbox"
                          checked={daTra}
                          onChange={(e) => tickDaTra(d.maNhanVien, e.target.checked)}
                          aria-label={`Đã trả cho ${d.tenBangLuong}`}
                        />
                        {daTra && <span className="ok-tick">✓ đã trả</span>}
                      </label>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="total">
                <td>Tổng cộng</td>
                <td className="num">
                  {vnd(kq.dongBang.reduce((s, d) => s + d.thanhTien, 0))}
                </td>
                <td className="num">
                  {vnd(kq.dongBang.reduce((s, d) => s + khauTruHt(d.maNhanVien), 0))}
                </td>
                <td className="num big">{vnd(tong.tienMat)}</td>
                <td className="ok-tick">
                  đã phát {tong.daPhat}/{M}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {kq.dongBang.some((d) => tinhThucNhan(d.thanhTien, khauTruHt(d.maNhanVien)) < 0) && (
          <p className="note" role="status">
            ⚠ Có nhân viên “thực nhận” âm (khấu trừ lớn hơn lương) — kiểm lại nếu không cố ý.
          </p>
        )}
        <p className="note">
          Thực nhận = thành tiền − khấu trừ, làm tròn 1.000đ. Khấu trừ nhập lại mỗi kỳ. Số
          công / OT / thành tiền của kỳ đã lưu không sửa được ở đây.
        </p>
      </div>

      {/* Bản in (C14) — CSS @media print chỉ chừa vùng này */}
      <div className="printsheet" aria-hidden="true">
        <h2>DANH SÁCH PHÁT LƯƠNG — kỳ {kq.thang}</h2>
        <p>
          {dmy(kq.khoangNgay.tu)} – {dmy(kq.khoangNgay.den)} · Tổng tiền mặt: {vnd(tong.tienMat)} đ
        </p>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên</th>
              <th>Thực nhận</th>
              <th>Ký nhận</th>
            </tr>
          </thead>
          <tbody>
            {kq.dongBang.map((d, i) => (
              <tr key={d.maNhanVien}>
                <td>{i + 1}</td>
                <td>{d.tenBangLuong}</td>
                <td className="num">{vnd(tinhThucNhan(d.thanhTien, khauTruHt(d.maNhanVien)))}</td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </>
  )
}
