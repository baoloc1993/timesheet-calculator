import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import { PageHead } from '../components/PageHead'
import type { KetQuaKy } from '../../../preload/api-types'
import { tinhThucNhanDayDu, chuyenCanCua, tinhChuyenCan } from '../../../preload/api-types'

const vnd = (n: number) => n.toLocaleString('vi-VN')
const so1 = (n: number) => n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** "1.234" / " 500 " → 1234 / 500; rỗng → 0; không phải số/âm → null (báo lỗi). Dùng chung cho
 * cả lưu (onBlur) lẫn hiển thị tạm khi đang gõ — một chỗ đổi luật, không lệch nhau. */
function parseSoNhap(raw: string): number | null {
  const s = raw.trim().replace(/[.\s]/g, '')
  const n = s === '' ? 0 : Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

/** Chỉ giữ chữ số rồi chèn dấu chấm phân cách nghìn kiểu vi-VN — dùng cho ô nhập 5 khoản
 * (người dùng phản hồi 2026-09-09: 5 ô này thiếu phân cách, khác các số hiển thị khác trên
 * cùng màn đã có qua vnd()). Lưu trữ dạng đã format luôn — parseSoNhap strip dấu chấm nên
 * không cần giữ 2 bản song song. */
function formatSoNhap(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '')
  return digits ? Number(digits).toLocaleString('vi-VN') : ''
}

// Vòng 6 — 5 khoản: 3 cộng (chuyenCan/buLuong/le) + 2 trừ (baoHiem, khauTru = "Vay").
const KHOAN = [
  { truong: 'chuyenCan', nhan: 'Chuyên cần' },
  { truong: 'buLuong', nhan: 'Bù lương' },
  { truong: 'le', nhan: 'Lễ' },
  { truong: 'baoHiem', nhan: 'Bảo hiểm' },
  { truong: 'khauTru', nhan: 'Vay' }
] as const
type Truong = (typeof KHOAN)[number]['truong']

type NhapKhoan = Record<Truong, string>

function nhapRong(kq: KetQuaKy, d: KetQuaKy['dongBang'][number]): NhapKhoan {
  const ma = d.maNhanVien
  return {
    chuyenCan: formatSoNhap(String(chuyenCanCua(kq, d))),
    buLuong: formatSoNhap(String(kq.buLuong?.[ma] ?? 0)),
    le: formatSoNhap(String(kq.le?.[ma] ?? 0)),
    baoHiem: formatSoNhap(String(kq.baoHiem?.[ma] ?? 0)),
    khauTru: formatSoNhap(String(kq.khauTru[ma] ?? 0))
  }
}

export function S10PhatLuong() {
  const { thangDangXem, di, moInPhieu, lamMoiDanhSachKy } = useApp()
  const [kq, setKq] = useState<KetQuaKy | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [nhap, setNhap] = useState<Record<string, NhapKhoan>>({})
  const [loiO, setLoiO] = useState<Record<string, string>>({})
  // Thực nhận lúc mở màn — để đánh dấu ô Thực nhận nào đã đổi trong phiên (người dùng phản hồi
  // 2026-10-01: sửa 5 khoản mà cột Thực nhận không có dấu hiệu gì).
  const thucNhanGoc = useRef<Record<string, number>>({})

  const nap = useCallback(async () => {
    if (!thangDangXem) {
      setKq(null)
      setDangTai(false)
      return
    }
    setDangTai(true)
    const k = await window.api.docKy(thangDangXem)
    setKq(k)
    setNhap(Object.fromEntries((k?.dongBang ?? []).map((d) => [d.maNhanVien, nhapRong(k!, d)])))
    thucNhanGoc.current = Object.fromEntries(
      (k?.dongBang ?? []).map((d) => {
        const n = nhapRong(k!, d)
        const so = (t: Truong) => parseSoNhap(n[t]) ?? 0
        return [
          d.maNhanVien,
          tinhThucNhanDayDu(d.thanhTien, so('khauTru'), {
            chuyenCan: so('chuyenCan'),
            buLuong: so('buLuong'),
            le: so('le'),
            baoHiem: so('baoHiem')
          })
        ]
      })
    )
    setDangTai(false)
  }, [thangDangXem])

  useEffect(() => {
    nap()
  }, [nap])

  async function luuGiaTri(ma: string, truong: Truong, nhanHienThi: string) {
    if (!kq) return
    const khoa = `${ma}:${truong}`
    const raw = nhap[ma]?.[truong] ?? ''
    const d = kq.dongBang.find((x) => x.maNhanVien === ma)
    // Chuyên cần: xoá trắng ô = bỏ số nhập tay, quay về tự tính theo ngày công.
    if (truong === 'chuyenCan' && raw.trim() === '' && d) {
      setLoiO((m) => ({ ...m, [khoa]: '' }))
      setNhap((m) => ({ ...m, [ma]: { ...m[ma], chuyenCan: formatSoNhap(String(tinhChuyenCan(d.ngayCong))) } }))
      if (kq.chuyenCan?.[ma] === undefined) return
      const r = await window.api.capNhatPhatLuong({ thang: kq.thang, maNhanVien: ma, chuyenCan: null })
      if (r.ok && r.data) {
        const moi = r.data
        setKq(moi)
        setNhap((m) => ({ ...m, [ma]: { ...m[ma], chuyenCan: formatSoNhap(String(chuyenCanCua(moi, d))) } }))
        await lamMoiDanhSachKy()
      } else {
        setLoiO((m) => ({ ...m, [khoa]: r.loi ?? 'Không lưu được.' }))
      }
      return
    }
    const so = parseSoNhap(raw)
    if (so === null) {
      setLoiO((m) => ({ ...m, [khoa]: `${nhanHienThi} phải là số không âm.` }))
      return
    }
    setLoiO((m) => ({ ...m, [khoa]: '' }))
    // Không đổi gì → không ghi (tránh "đóng băng" số chuyên cần tự tính chỉ vì bấm qua ô).
    const daLuu =
      truong === 'khauTru'
        ? kq.khauTru[ma] ?? 0
        : truong === 'chuyenCan' && d
          ? chuyenCanCua(kq, d)
          : kq[truong]?.[ma] ?? 0
    if (so === daLuu) return
    const r = await window.api.capNhatPhatLuong({
      thang: kq.thang,
      maNhanVien: ma,
      khauTru: truong === 'khauTru' ? so : undefined,
      chuyenCan: truong === 'chuyenCan' ? so : undefined,
      buLuong: truong === 'buLuong' ? so : undefined,
      le: truong === 'le' ? so : undefined,
      baoHiem: truong === 'baoHiem' ? so : undefined
    })
    if (r.ok && r.data) {
      setKq(r.data)
      await lamMoiDanhSachKy()
    } else {
      setLoiO((m) => ({ ...m, [khoa]: r.loi ?? 'Không lưu được.' }))
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

  // Giá trị "đang hiển thị" = số trong ô nhập nếu hợp lệ, else số đã lưu. Bảng + bản in +
  // tổng đều đọc qua đây → "In danh sách" ngay sau khi gõ (chưa kịp onBlur lưu) vẫn in
  // đúng số (bug-hunter / reviewer: race window.print vs luuGiaTri bất đồng bộ).
  const giaTriHt = useCallback(
    (ma: string, truong: Truong): number => {
      const raw = nhap[ma]?.[truong]
      const d = kq?.dongBang.find((x) => x.maNhanVien === ma)
      if (raw !== undefined) {
        if (truong === 'chuyenCan' && raw.trim() === '' && d) return tinhChuyenCan(d.ngayCong)
        const so = parseSoNhap(raw)
        if (so !== null) return so
      }
      if (!kq) return 0
      if (truong === 'chuyenCan' && d) return chuyenCanCua(kq, d)
      return truong === 'khauTru' ? kq.khauTru[ma] ?? 0 : kq[truong]?.[ma] ?? 0
    },
    [nhap, kq]
  )

  const thucNhanHt = useCallback(
    (ma: string, thanhTien: number): number =>
      tinhThucNhanDayDu(thanhTien, giaTriHt(ma, 'khauTru'), {
        chuyenCan: giaTriHt(ma, 'chuyenCan'),
        buLuong: giaTriHt(ma, 'buLuong'),
        le: giaTriHt(ma, 'le'),
        baoHiem: giaTriHt(ma, 'baoHiem')
      }),
    [giaTriHt]
  )

  const tong = useMemo(() => {
    if (!kq) return { tienMat: 0, chuaNhan: 0, daPhat: 0 }
    let tienMat = 0
    let chuaNhan = 0
    let daPhat = 0
    for (const d of kq.dongBang) {
      tienMat += thucNhanHt(d.maNhanVien, d.thanhTien)
      if (kq.daTra[d.maNhanVien] === true) daPhat++
      else chuaNhan++
    }
    return { tienMat, chuaNhan, daPhat }
  }, [kq, thucNhanHt])

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
            <button className="btn" onClick={() => moInPhieu(null)}>
              In phiếu
            </button>
            <button className="btn" onClick={() => di('s12')}>
              Phát từng người
            </button>
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
                <th className="num">Ngày công</th>
                <th className="num">Thành tiền</th>
                {KHOAN.map((k) => (
                  <th key={k.truong} className="num">
                    {k.nhan}
                  </th>
                ))}
                <th className="num">Thực nhận</th>
                <th>Đã trả</th>
              </tr>
            </thead>
            <tbody>
              {kq.dongBang.map((d) => {
                const tn = thucNhanHt(d.maNhanVien, d.thanhTien)
                const goc = thucNhanGoc.current[d.maNhanVien]
                const lech = goc === undefined ? 0 : tn - goc
                const daTra = kq.daTra[d.maNhanVien] === true
                return (
                  <tr key={d.maNhanVien} className={daTra ? 'da-tra' : ''}>
                    <td>{d.tenBangLuong}</td>
                    <td className="num">{so1(d.ngayCong)}</td>
                    <td className="num">{vnd(d.thanhTien)}</td>
                    {KHOAN.map((k) => {
                      const khoa = `${d.maNhanVien}:${k.truong}`
                      const ccTuTinh = tinhChuyenCan(d.ngayCong)
                      const ccTay = k.truong === 'chuyenCan' ? kq.chuyenCan?.[d.maNhanVien] : undefined
                      return (
                        <td className="num" key={k.truong}>
                          <input
                            className={'inline-input' + (loiO[khoa] ? ' loi' : '')}
                            style={{ textAlign: 'right', width: 96 }}
                            inputMode="numeric"
                            value={nhap[d.maNhanVien]?.[k.truong] ?? ''}
                            onChange={(e) =>
                              setNhap((m) => ({
                                ...m,
                                [d.maNhanVien]: { ...m[d.maNhanVien], [k.truong]: formatSoNhap(e.target.value) }
                              }))
                            }
                            onBlur={() => luuGiaTri(d.maNhanVien, k.truong, k.nhan)}
                            aria-label={`${k.nhan} của ${d.tenBangLuong}`}
                            title={
                              k.truong === 'chuyenCan'
                                ? `Tự tính theo ${so1(d.ngayCong)} công: ${vnd(ccTuTinh)}. Xoá trắng ô để quay về số tự tính.`
                                : undefined
                            }
                          />
                          {ccTay !== undefined && ccTay !== ccTuTinh && (
                            <div className="muted goi-y-tu-tinh">tự tính {vnd(ccTuTinh)}</div>
                          )}
                          {loiO[khoa] && <div className="err small">{loiO[khoa]}</div>}
                        </td>
                      )
                    })}
                    <td
                      className={'num tiennhan' + (tn < 0 ? ' am' : '') + (lech !== 0 ? ' da-doi' : '')}
                      title={lech !== 0 ? `Trước khi sửa: ${vnd(goc!)}` : undefined}
                    >
                      {vnd(tn)}
                      {lech !== 0 && (
                        <div className="lech">
                          {lech > 0 ? '▲ +' : '▼ −'}
                          {vnd(Math.abs(lech))}
                        </div>
                      )}
                    </td>
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
                <td></td>
                <td className="num">
                  {vnd(kq.dongBang.reduce((s, d) => s + d.thanhTien, 0))}
                </td>
                {KHOAN.map((k) => (
                  <td className="num" key={k.truong}>
                    {vnd(kq.dongBang.reduce((s, d) => s + giaTriHt(d.maNhanVien, k.truong), 0))}
                  </td>
                ))}
                <td className="num big">{vnd(tong.tienMat)}</td>
                <td className="ok-tick">
                  đã phát {tong.daPhat}/{M}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {kq.dongBang.some((d) => thucNhanHt(d.maNhanVien, d.thanhTien) < 0) && (
          <p className="note" role="status">
            ⚠ Có nhân viên &quot;thực nhận&quot; âm (bảo hiểm + vay lớn hơn thành tiền + chuyên cần + bù lương +
            lễ) — kiểm lại nếu không cố ý.
          </p>
        )}
        <p className="note">
          Thực nhận = thành tiền + Chuyên cần + Bù lương + Lễ − Bảo hiểm − Vay, làm tròn 1.000đ. 5 khoản nhập lại
          mỗi kỳ. Chuyên cần tự tính theo ngày công (từ 27 công: 100.000đ, mỗi nửa công thêm 50.000đ) — sửa tay
          được, xoá trắng ô để quay về số tự tính. Ô Thực nhận tô vàng = đã đổi so với lúc mở màn. Số công / OT / thành tiền của kỳ đã lưu không sửa được ở đây.
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
                <td className="num">{vnd(thucNhanHt(d.maNhanVien, d.thanhTien))}</td>
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
