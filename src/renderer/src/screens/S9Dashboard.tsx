import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import type { KetQuaKy } from '../../../preload/api-types'
import { tongKetQuaKy } from '../../../preload/api-types'

const so2 = (n: number) => Math.round(n * 100) / 100
const vnd = (n: number) => n.toLocaleString('vi-VN')

interface DongXem {
  ten: string
  ngayCong: number
  gioOT: number
  thanhTien: number
}
interface KyXem {
  thang: string
  khoang: string
  ngayLuu: string | null
  rows: DongXem[]
  tongNgayCong: number
  tongGioOT: number
  tongThanhTien: number
}

export function S9Dashboard() {
  const { ky, di, xemChamCongGoc, danhSachKy, lamMoiDanhSachKy, thangDangXem, moKy } = useApp()
  const [luuLoi, setLuuLoi] = useState<string | null>(null)
  const [dangLuu, setDangLuu] = useState(false)

  // Kỳ đang tính trong phiên LUÔN hiện như thẻ "chưa lưu" ở đầu — kể cả
  // khi thang đó đã có bản lưu: người dùng "nạp lại + tính lại" rồi "Lưu kỳ này" để ghi đè
  //. Nút "Lưu kỳ này" sẽ hỏi xác nhận ghi đè.
  const kyChuaLuu = !!ky
  const daCoBanLuu = !!ky && danhSachKy.some((k) => k.thang === ky.thang)

  // Kỳ đang chọn: null = kỳ chưa lưu (nếu có), else = kỳ đã lưu theo thang.
  const chon: string | null = thangDangXem
  const kyDaLuu: KetQuaKy | undefined =
    chon != null ? danhSachKy.find((k) => k.thang === chon) : undefined

  useEffect(() => {
    // Chưa chọn gì mà cũng không có kỳ chưa lưu → chọn kỳ đã lưu mới nhất.
    if (chon == null && !kyChuaLuu && danhSachKy.length > 0) moKy(danhSachKy[0].thang)
  }, [chon, kyChuaLuu, danhSachKy, moKy])

  const xem: KyXem | null = useMemo(() => {
    if (chon == null && kyChuaLuu && ky) {
      return {
        thang: ky.thang,
        khoang: `${dmy(ky.ngayBatDau)} – ${dmy(ky.ngayKetThuc)}`,
        ngayLuu: null,
        rows: ky.tongHop.map((t) => ({
          ten: t.tenBangLuong || t.tenMay,
          ngayCong: t.tongNgayCong,
          gioOT: t.tongGioOT,
          thanhTien: t.thanhTien
        })),
        tongNgayCong: ky.tongNgayCongCaKy,
        tongGioOT: ky.tongGioOTCaKy,
        tongThanhTien: ky.tongThanhTienCaKy
      }
    }
    if (kyDaLuu) {
      const tg = tongKetQuaKy(kyDaLuu)
      return {
        thang: kyDaLuu.thang,
        khoang: `${dmy(kyDaLuu.khoangNgay.tu)} – ${dmy(kyDaLuu.khoangNgay.den)}`,
        ngayLuu: kyDaLuu.ngayLuu,
        rows: kyDaLuu.dongBang.map((d) => ({
          ten: d.tenBangLuong,
          ngayCong: d.ngayCong,
          gioOT: d.gioOT,
          thanhTien: d.thanhTien
        })),
        tongNgayCong: tg.tongNgayCong,
        tongGioOT: tg.tongGioOT,
        tongThanhTien: tg.tongThanhTien
      }
    }
    return null
  }, [chon, kyChuaLuu, ky, kyDaLuu])

  async function luuKy() {
    setLuuLoi(null)
    setDangLuu(true)
    try {
      let r = await window.api.luuKy({ ghiDe: false })
      if (r.canXacNhanGhiDe) {
        if (!window.confirm(r.canXacNhanGhiDe)) return
        r = await window.api.luuKy({ ghiDe: true })
      }
      if (!r.ok || !r.data) {
        setLuuLoi(r.loi ?? 'Không lưu được kỳ.')
        return
      }
      await lamMoiDanhSachKy()
      moKy(r.data.thang)
      di('s10')
    } finally {
      setDangLuu(false)
    }
  }

  const trong = !kyChuaLuu && danhSachKy.length === 0

  return (
    <>
      <h1>
        Dashboard <span className="sub">lịch sử các kỳ đã lưu</span>
      </h1>

      <div className="dash">
        <div className="dash-list">
          <button className="btn primary block" onClick={() => di('s1')}>
            + Nạp kỳ mới
          </button>

          {trong ? (
            <div className="empty">
              <p>Chưa lưu kỳ nào — nạp file kỳ mới rồi bấm “Lưu kỳ này”.</p>
            </div>
          ) : (
            <div className="period-list">
              {kyChuaLuu && ky && (
                <button
                  className={'period-card chua-luu' + (chon == null ? ' selected' : '')}
                  onClick={() => moKy(null)}
                >
                  <div className="pc-thang">
                    {ky.thang}{' '}
                    <span className="chip">{daCoBanLuu ? 'đang tính (có bản đã lưu)' : 'chưa lưu'}</span>
                  </div>
                  <div className="pc-nums">
                    <span>{so2(ky.tongNgayCongCaKy)} công</span>
                    <span>{so2(ky.tongGioOTCaKy)} OT</span>
                    <span>{vnd(ky.tongThanhTienCaKy)}₫</span>
                  </div>
                </button>
              )}
              {danhSachKy.map((k) => {
                const tg = tongKetQuaKy(k)
                return (
                  <button
                    key={k.thang}
                    className={'period-card' + (chon === k.thang ? ' selected' : '')}
                    onClick={() => moKy(k.thang)}
                  >
                    <div className="pc-thang">{k.thang}</div>
                    <div className="pc-luu small muted">lưu {k.ngayLuu.slice(0, 10)}</div>
                    <div className="pc-nums">
                      <span>{so2(tg.tongNgayCong)} công</span>
                      <span>{so2(tg.tongGioOT)} OT</span>
                      <span>{vnd(tg.tongThanhTien)}₫</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="dash-detail">
          {!xem ? (
            <div className="card">
              <div className="empty">
                <p>Chọn một kỳ ở danh sách bên trái để xem chi tiết.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="toolbar">
                {chon == null && kyChuaLuu ? (
                  <>
                    <button
                      className="btn primary"
                      disabled={dangLuu || (ky?.thieuSetup.length ?? 0) > 0}
                      aria-busy={dangLuu}
                      onClick={luuKy}
                    >
                      {dangLuu ? 'Đang lưu…' : 'Lưu kỳ này'}
                    </button>
                    {(ky?.thieuSetup.length ?? 0) > 0 && (
                      <span className="muted small" style={{ alignSelf: 'center' }}>
                        còn {ky?.thieuSetup.length} nhân viên chưa khai Setup — khai đủ trước khi lưu
                      </span>
                    )}
                  </>
                ) : (
                  <button className="btn primary" onClick={() => di('s10')}>
                    Phát lương kỳ này
                  </button>
                )}
                {chon == null && kyChuaLuu && ky && (
                  <button
                    className="btn"
                    disabled={!ky.tongHop.length}
                    onClick={() => xemChamCongGoc(ky.tongHop[0]?.maNhanVien)}
                  >
                    Xem chấm công gốc
                  </button>
                )}
              </div>

              {luuLoi && (
                <div className="errorbox" style={{ marginBottom: 'var(--space-lg)' }}>
                  <strong>Chưa lưu được kỳ.</strong>
                  <p className="small">{luuLoi}</p>
                </div>
              )}

              <h2 style={{ margin: '0 0 var(--space-md)' }}>
                Kỳ {xem.thang} <span className="sub">{xem.khoang}</span>
                {xem.ngayLuu && (
                  <span className="muted small"> · đã lưu {xem.ngayLuu.slice(0, 10)}</span>
                )}
              </h2>

              <div className="stats">
                <div className="stat">
                  <div className="num">{so2(xem.tongNgayCong)}</div>
                  <div className="label">Tổng ngày công</div>
                </div>
                <div className="stat">
                  <div className="num">{so2(xem.tongGioOT)}</div>
                  <div className="label">Tổng giờ tăng ca</div>
                </div>
                <div className="stat">
                  <div className="num">{vnd(xem.tongThanhTien)}</div>
                  <div className="label">Tổng thành tiền (VND)</div>
                </div>
              </div>

              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th className="num">Ngày công</th>
                        <th className="num">Giờ OT</th>
                        <th className="num">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {xem.rows.map((d, i) => (
                        <tr key={i}>
                          <td>{d.ten}</td>
                          <td className="num">{so2(d.ngayCong)}</td>
                          <td className="num">{so2(d.gioOT)}</td>
                          <td className="num">{vnd(d.thanhTien)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total">
                        <td>Tổng cộng kỳ</td>
                        <td className="num">{so2(xem.tongNgayCong)}</td>
                        <td className="num">{so2(xem.tongGioOT)}</td>
                        <td className="num big">{vnd(xem.tongThanhTien)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {xem.ngayLuu && (
                  <p className="note">
                    Kỳ đã lưu — số công / OT / thành tiền đóng băng lúc lưu, không tính lại. Mở
                    “Phát lương kỳ này” để nhập khấu trừ + đánh dấu đã trả.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
