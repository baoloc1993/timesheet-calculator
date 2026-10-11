import { useEffect, useMemo } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import { PageHead } from '../components/PageHead'
import type { KetQuaKy } from '../../../preload/api-types'
import { tongKetQuaKy, chonKyMacDinh } from '../../../preload/api-types'

const so2 = (n: number) => Math.round(n * 100) / 100
const vnd = (n: number) => n.toLocaleString('vi-VN')

interface DiemQuy {
  thang: string
  nhan: string
  tong: number
  hienTai: boolean
}

/** Biểu đồ quỹ lương 3 kỳ gần nhất (SVG tĩnh, không tương tác) — S9.
 *  Chỉ ngữ cảnh hình ảnh, không phải "so sánh liên kỳ" đầy đủ. */
function BieuDoQuyLuong({ diem }: { diem: DiemQuy[] }) {
  if (diem.length < 2) return null
  const w = 380
  const h = 110
  const bw = 64
  const gap = (w - bw * diem.length) / (diem.length + 1)
  const max = Math.max(...diem.map((d) => d.tong), 1)
  return (
    <div className="card chartcard">
      <div className="ct">
        <h2 style={{ margin: 0 }}>Quỹ lương 3 kỳ gần nhất</h2>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Biểu đồ quỹ lương 3 kỳ gần nhất">
        <line x1={0} y1={h - 20} x2={w} y2={h - 20} stroke="var(--chart-axis)" />
        {diem.map((d, i) => {
          const x = gap + i * (bw + gap)
          const barH = (d.tong / max) * (h - 40)
          return (
            <g key={d.thang}>
              <rect
                x={x}
                y={h - 20 - barH}
                width={bw}
                height={barH}
                fill={d.hienTai ? 'var(--chart-bar-strong)' : 'var(--chart-bar)'}
                rx={3}
              />
              <text className="cv" x={x + bw / 2} y={h - 24 - barH} textAnchor="middle">
                {vnd(Math.round(d.tong / 1000))}k
              </text>
              <text className="cx" x={x + bw / 2} y={h - 6} textAnchor="middle">
                {d.nhan}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

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
  const {
    ky,
    di,
    xemChamCongGoc,
    danhSachKy,
    thangDangXem,
    moKy,
    tuDongNapLoi,
    tuDongNapCanhBao
  } = useApp()
  // Kỳ đang mở trong phiên LUÔN hiện như thẻ riêng ở đầu —: mỗi
  // lần tính/sửa tự ghi ngay vào lịch sử (không còn nút "Lưu kỳ này"), nên kỳ này LUÔN cũng
  // có mặt trong `danhSachKy`; tách riêng chỉ để hiện số liệu SỐNG từ bộ nhớ (nhanh hơn, phản
  // ánh sửa tay tức thì) thay vì đọc lại từ đĩa.
  const kyChuaLuu = !!ky

  // Kỳ đang chọn: null = kỳ đang mở (nếu có), else = kỳ khác trong lịch sử theo thang.
  const chon: string | null = thangDangXem
  const kyDaLuu: KetQuaKy | undefined =
    chon != null ? danhSachKy.find((k) => k.thang === chon) : undefined

  // chưa có lựa chọn nào (tay hoặc mặc định trước đó) → áp quy tắc
  // ngày-trong-tháng để quyết BẢNG CHI TIẾT nào mở sẵn. KHÔNG đụng thứ tự thẻ trong danh
  // sách: ngày ≤5
  // có thể chọn một kỳ ĐÃ LƯU làm mặc định dù đang có kỳ chưa lưu (`chon` rời khỏi null).
  useEffect(() => {
    if (chon != null) return
    const macDinh = chonKyMacDinh(
      danhSachKy.map((k) => k.thang),
      new Date(),
      kyChuaLuu
    )
    if (macDinh.loai === 'da-luu') moKy(macDinh.thang)
    // 'dang-mo' → giữ chon=null (đúng — hiện kỳ đang mở) · 'khong-co' → giữ khuôn cũ.
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

  const trong = !kyChuaLuu && danhSachKy.length === 0

  // thiếu Setup không còn chặn tự lưu (mọi kỳ đều tự ghi), chỉ khoá "Phát lương"
  // tới khi khai đủ rồi nạp lại (`KetQuaKy.thieuSetup`, persist để còn biết khi quay lại sau
  // khi tắt/mở app — trước việc chặn nằm ở chính bước "Lưu kỳ này").
  const thieuSetupCount =
    chon == null && kyChuaLuu && ky ? ky.thieuSetup.length : (kyDaLuu?.thieuSetup?.length ?? 0)

  // Quỹ lương 3 kỳ gần nhất (kỳ đang tính chưa lưu, nếu có, + tối đa 2 kỳ đã lưu gần nhất),
  // sắp xưa → nay. Thuần ngữ cảnh hình ảnh, không đọc lại dữ liệu mới.
  const diemQuy = useMemo(() => {
    const dsSau = danhSachKy.filter((k) => !(kyChuaLuu && k.thang === ky!.thang))
    const arr = [
      ...dsSau.slice(0, kyChuaLuu ? 2 : 3).map((k) => ({
        thang: k.thang,
        nhan: k.thang.slice(-2) + '/' + k.thang.slice(2, 4),
        tong: tongKetQuaKy(k).tongThanhTien,
        hienTai: false
      })),
      ...(kyChuaLuu && ky
        ? [
            {
              thang: ky.thang,
              nhan: ky.thang.slice(-2) + '/' + ky.thang.slice(2, 4) + ' (chưa lưu)',
              tong: ky.tongThanhTienCaKy,
              hienTai: true
            }
          ]
        : [])
    ]
    return arr.sort((a, b) => a.thang.localeCompare(b.thang))
  }, [danhSachKy, kyChuaLuu, ky])

  return (
    <>
      <PageHead title="Dashboard" sub="lịch sử các kỳ đã lưu" />
      <div className="page-body">

      {tuDongNapLoi && (
        <p className="note" role="status">
          Không tự nạp/đồng bộ được — {tuDongNapLoi}{' '}
          <button className="lien-ket" onClick={() => di('s1')}>
            Nạp/đồng bộ tay
          </button>
        </p>
      )}
      {tuDongNapCanhBao && (
        <p className="note" role="status">
          Đã tự đồng bộ xong, nhưng có {tuDongNapCanhBao.length} cảnh báo khi gom dữ liệu:{' '}
          {tuDongNapCanhBao.join('; ')}
        </p>
      )}

      <div className="dash">
        <div className="dash-list">
          <button className="btn primary block" onClick={() => di('s1')}>
            + Nạp kỳ mới
          </button>

          {trong ? (
            <div className="empty">
              <p>Chưa có kỳ nào — nạp file kỳ mới để bắt đầu, số tự lưu ngay.</p>
            </div>
          ) : (
            <div className="period-list">
              {kyChuaLuu && ky && (
                <button
                  className={'period-card chua-luu' + (chon == null ? ' selected' : '')}
                  onClick={() => moKy(null)}
                >
                  <div className="pc-thang">
                    {ky.thang} <span className="chip">đang mở</span>
                  </div>
                  <div className="pc-nums">
                    <span>{so2(ky.tongNgayCongCaKy)} công</span>
                    <span>{so2(ky.tongGioOTCaKy)} OT</span>
                    <span>{vnd(ky.tongThanhTienCaKy)}₫</span>
                  </div>
                  {ky.thieuSetup.length > 0 && (
                    <div className="pc-luu small" style={{ color: 'var(--color-danger)' }}>
                      ⚠ chưa đủ Setup ({ky.thieuSetup.length}) — số còn thiếu người
                    </div>
                  )}
                </button>
              )}
              {danhSachKy
                .filter((k) => !(kyChuaLuu && ky && k.thang === ky.thang))
                .map((k) => {
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
                <button
                  className="btn primary"
                  disabled={thieuSetupCount > 0}
                  onClick={() => {
                    // S10 đọc theo `thangDangXem` (`docKy`) — kỳ đang mở (chon==null) chưa
                    // từng đặt biến này (chỉ đặt khi bấm một thẻ trong danh sách), phải tự đặt
                    // trước khi sang màn, dù đã tự lưu (`luuTuDong()`) ngay lúc tính/sửa.
                    if (chon == null && ky) moKy(ky.thang)
                    di('s10')
                  }}
                >
                  Phát lương kỳ này
                </button>
                {thieuSetupCount > 0 && (
                  <span className="muted small" style={{ alignSelf: 'center' }}>
                    còn {thieuSetupCount} nhân viên chưa khai Setup — khai đủ rồi nạp lại
                  </span>
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

              <BieuDoQuyLuong diem={diemQuy} />

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
      </div>
    </>
  )
}
