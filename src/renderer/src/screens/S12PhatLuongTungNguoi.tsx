import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import { PageHead } from '../components/PageHead'
import type { KetQuaKy, NguoiPhat } from '../../../preload/api-types'
import { dsNguoiPhat } from '../../../preload/api-types'

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫'
const so2 = (n: number) => n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function bochdau(t: string): string {
  return t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function S12PhatLuongTungNguoi() {
  const { thangDangXem, di, moInPhieu } = useApp()
  const [kq, setKq] = useState<KetQuaKy | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [dangXemMa, setDangXemMa] = useState<string | null>(null)
  const [chiChua, setChiChua] = useState(false)
  const [timKiem, setTimKiem] = useState('')

  const nap = useCallback(async () => {
    if (!thangDangXem) {
      setKq(null)
      setDangTai(false)
      return
    }
    setDangTai(true)
    setKq(await window.api.docKy(thangDangXem))
    setDangTai(false)
  }, [thangDangXem])

  useEffect(() => {
    nap()
  }, [nap])

  const ds: NguoiPhat[] = useMemo(() => (kq ? dsNguoiPhat(kq) : []), [kq])

  const tong = useMemo(() => {
    let phai = 0
    let con = 0
    let xong = 0
    for (const p of ds) {
      if (p.chan) continue
      phai += p.thucNhan
      if (p.daTra) xong++
      else con += p.thucNhan
    }
    return { phai, con, xong, tong: ds.length }
  }, [ds])

  const nguoiXem = dangXemMa ? ds.find((p) => p.d.maNhanVien === dangXemMa) ?? null : null

  const veDanhSach = useCallback(() => setDangXemMa(null), [])

  async function xacNhanDaTra(p: NguoiPhat) {
    if (!kq) return
    const r = await window.api.capNhatPhatLuong({ thang: kq.thang, maNhanVien: p.d.maNhanVien, daTra: true })
    if (r.ok && r.data) {
      setKq(r.data)
      veDanhSach()
    }
  }
  async function huyDaTra(p: NguoiPhat) {
    if (!kq) return
    const r = await window.api.capNhatPhatLuong({ thang: kq.thang, maNhanVien: p.d.maNhanVien, daTra: false })
    if (r.ok && r.data) setKq(r.data)
  }

  // Enter xác nhận đã đưa (khi đang xem một người, không phải trong ô nhập) · Esc quay danh sách.
  useEffect(() => {
    if (!nguoiXem) return
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      if (el.matches('input, select, textarea')) return
      if (e.key === 'Escape') {
        veDanhSach()
        e.preventDefault()
      }
      if (e.key === 'Enter' && nguoiXem && !nguoiXem.chan && !nguoiXem.daTra) {
        xacNhanDaTra(nguoiXem)
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nguoiXem, veDanhSach])

  if (!thangDangXem) {
    return (
      <>
        <PageHead crumb="Phát lương" title="Phát lương từng người" />
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

  if (dangTai || !kq) {
    return (
      <>
        <PageHead crumb="Phát lương" title="Phát lương từng người" />
        <div className="page-body">
          <p className="loading">{dangTai ? 'Đang tải kỳ…' : `Không tìm thấy kỳ ${thangDangXem} đã lưu.`}</p>
        </div>
      </>
    )
  }

  const q = bochdau(timKiem.trim())
  const hop = ds.filter((p) => {
    if (chiChua && p.daTra) return false
    if (!q) return true
    return bochdau(p.d.tenBangLuong).includes(q) || p.d.maNhanVien.toLowerCase().includes(q)
  })
  const chua = hop.filter((p) => !p.daTra && !p.chan)
  const chan = hop.filter((p) => p.chan)
  const xong = hop.filter((p) => p.daTra)
  const chuaTong = ds.filter((p) => !p.daTra && !p.chan).length

  function nutNguoi(p: NguoiPhat, cls: string) {
    return (
      <button key={p.d.maNhanVien} className={'pick-btn ' + cls} onClick={() => setDangXemMa(p.d.maNhanVien)}>
        <span className="pn">{p.d.tenBangLuong}</span>
        <span className="pm">mã {p.d.maNhanVien}</span>
        <span className="pv">{p.chan ? p.chan : (p.daTra ? '✓ đã nhận ' : '') + vnd(p.thucNhan)}</span>
      </button>
    )
  }

  return (
    <>
      <PageHead
        crumb="Phát lương"
        title="Phát lương từng người"
        sub={
          <>
            kỳ {kq.thang} · gọi tên, đưa tiền, bấm xác nhận — mỗi màn một người
          </>
        }
        actions={
          <button className="btn" onClick={() => di('s10')}>
            ▤ Về danh sách
          </button>
        }
      />
      <div className="page-body">
        <div className="pay1">
          {!nguoiXem ? (
            <>
              <div className="pay1-step">
                <span>Gọi ai thì bấm tên người đó</span>
                <div className="bar">
                  <i style={{ width: `${(tong.xong / (tong.tong || 1)) * 100}%` }} />
                </div>
                <span className="num">
                  đã phát {tong.xong}/{tong.tong}
                </span>
              </div>

              <div className="pick-filter">
                <button aria-pressed={!chiChua} onClick={() => setChiChua(false)}>
                  Tất cả<span className="n">{ds.length}</span>
                </button>
                <button aria-pressed={chiChua} onClick={() => setChiChua(true)}>
                  Chỉ người chưa nhận<span className="n">{chuaTong}</span>
                </button>
              </div>

              <div className="pick-or">hoặc gõ tên nếu danh sách dài</div>
              <div className="pick-search">
                <span className="si">⌕</span>
                <input
                  type="text"
                  value={timKiem}
                  autoComplete="off"
                  placeholder="vd: my · dung · 00015"
                  aria-label="Tìm người nhận lương theo tên hoặc mã"
                  onChange={(e) => setTimKiem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && chua.length === 1) setDangXemMa(chua[0].d.maNhanVien)
                    if (e.key === 'Escape') setTimKiem('')
                  }}
                />
              </div>

              {!hop.length ? (
                <div className="pick-empty">Không có ai tên như vậy. Xoá bớt chữ rồi tìm lại.</div>
              ) : (
                <div className="pick-grid">
                  {chua.length > 0 && (
                    <>
                      <div className="pick-sec">Chưa nhận · {chua.length} người</div>
                      {chua.map((p) => nutNguoi(p, ''))}
                    </>
                  )}
                  {chan.length > 0 && (
                    <>
                      <div className="pick-sec">Chưa trả được · {chan.length} người</div>
                      {chan.map((p) => nutNguoi(p, 'chan'))}
                    </>
                  )}
                  {xong.length > 0 && (
                    <>
                      <div className="pick-sec">Đã nhận · {xong.length} người</div>
                      {xong.map((p) => nutNguoi(p, 'xong'))}
                    </>
                  )}
                </div>
              )}
              <p className="pay1-hint">
                Còn <b>{tong.tong - tong.xong} người</b> · <b className="num">{vnd(tong.con)}</b> chưa phát — bấm thẳng vào
                tên là nhanh nhất; gõ thì không cần dấu
              </p>
            </>
          ) : (
            <>
              <div className="pay1-step">
                <button className="btn small" onClick={veDanhSach}>
                  ‹ Danh sách
                </button>
                <div className="bar">
                  <i style={{ width: `${(tong.xong / (tong.tong || 1)) * 100}%` }} />
                </div>
                <span className="num">
                  đã phát {tong.xong}/{tong.tong}
                </span>
              </div>

              <div className="pay1-card">
                <div className="pay1-head">
                  <div className="pay1-name">{nguoiXem.d.tenBangLuong}</div>
                  <div className="pay1-meta">mã {nguoiXem.d.maNhanVien}</div>
                </div>
                <div className="pay1-body">
                  <div className="pay1-rows">
                    {!nguoiXem.coDonGia ? (
                      <div>
                        <span className="k">Thành tiền</span>
                        <span className="v">{vnd(nguoiXem.d.thanhTien)}</span>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="k">Ngày công</span>
                          <span className="calc">
                            {so2(nguoiXem.d.ngayCong)} công × {vnd(nguoiXem.d.donGiaNgay ?? 0)}
                          </span>
                          <span className="v">{vnd(nguoiXem.luongCong)}</span>
                        </div>
                        <div>
                          <span className="k">Tăng ca</span>
                          <span className="calc">
                            {so2(nguoiXem.d.gioOT)} giờ × {vnd(nguoiXem.d.donGiaGioOT ?? 0)}
                          </span>
                          <span className="v">{vnd(nguoiXem.tienOt)}</span>
                        </div>
                      </>
                    )}
                    {/* 5 khoản — chỉ hiện dòng có giá trị khác 0, */}
                    {nguoiXem.chuyenCan > 0 && (
                      <div>
                        <span className="k">Chuyên cần</span>
                        <span className="v">{vnd(nguoiXem.chuyenCan)}</span>
                      </div>
                    )}
                    {nguoiXem.buLuong > 0 && (
                      <div>
                        <span className="k">Bù lương</span>
                        <span className="v">{vnd(nguoiXem.buLuong)}</span>
                      </div>
                    )}
                    {nguoiXem.le > 0 && (
                      <div>
                        <span className="k">Lễ</span>
                        <span className="v">{vnd(nguoiXem.le)}</span>
                      </div>
                    )}
                    {nguoiXem.baoHiem > 0 && (
                      <div>
                        <span className="k">Bảo hiểm</span>
                        <span className="v tru">−{vnd(nguoiXem.baoHiem)}</span>
                      </div>
                    )}
                    {nguoiXem.khauTru > 0 && (
                      <div>
                        <span className="k">Vay</span>
                        <span className="v tru">−{vnd(nguoiXem.khauTru)}</span>
                      </div>
                    )}
                  </div>

                  {nguoiXem.chan ? (
                    <>
                      <div className="pay1-net am">
                        <span className="k">Chưa trả được người này</span>
                        <span className="v" style={{ fontSize: 'var(--text-xl)' }}>
                          {nguoiXem.chan}
                        </span>
                      </div>
                      <div className="errorbox" style={{ marginTop: 'var(--space-lg)' }}>
                        <strong>Đơn giá ngày và đơn giá giờ tăng ca đang là 0</strong>
                        <p className="small">
                          Tính ra 0 đồng nên không phát được. Khai đơn giá ở Setup rồi quay lại — số tự tính lại.
                        </p>
                      </div>
                      <div className="pay1-acts">
                        <button className="btn" onClick={() => di('s5')}>
                          Khai đơn giá cho {nguoiXem.d.tenBangLuong}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className={'pay1-net' + (nguoiXem.thucNhan < 0 ? ' am' : '')}>
                      <span className="k">Thực nhận</span>
                      <span className="v">{vnd(nguoiXem.thucNhan)}</span>
                    </div>
                  )}

                  {!nguoiXem.chan &&
                    (nguoiXem.daTra ? (
                      <>
                        <div className="pay1-done" style={{ marginTop: 'var(--space-lg)' }}>
                          <span>✓</span> Người này đã nhận lương rồi
                        </div>
                        <div className="pay1-side" style={{ marginTop: 'var(--space-md)' }}>
                          <button className="btn danger" onClick={() => huyDaTra(nguoiXem)}>
                            Bỏ đánh dấu đã nhận
                          </button>
                          <button className="btn" onClick={veDanhSach}>
                            ‹ Quay lại, gọi người khác
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="pay1-acts">
                        <button className="btn huge pay" onClick={() => xacNhanDaTra(nguoiXem)}>
                          ✓ Đã đưa {vnd(nguoiXem.thucNhan)} cho {nguoiXem.d.tenBangLuong}
                        </button>
                        <div className="pay1-side">
                          <button className="btn" onClick={veDanhSach}>
                            ‹ Quay lại, gọi người khác
                          </button>
                          <button className="btn" onClick={() => moInPhieu(nguoiXem.d.maNhanVien)}>
                            ⎙ In phiếu cho người này
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <p className="pay1-hint">
                Còn <b>{tong.tong - tong.xong} người</b> · <b className="num">{vnd(tong.con)}</b> chưa phát —{' '}
                <kbd>Enter</kbd> xác nhận đã đưa · <kbd>Esc</kbd> quay lại danh sách
              </p>
            </>
          )}
        </div>
        <p className="note muted small" style={{ textAlign: 'center' }}>
          kỳ {kq.thang} · {dmy(kq.khoangNgay.tu)} – {dmy(kq.khoangNgay.den)}
        </p>
      </div>
    </>
  )
}
