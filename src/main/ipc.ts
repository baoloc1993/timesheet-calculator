// Điều phối IPC + mở dialog chọn file/thư mục. Không nhúng logic tính — gọi xuống core/.

import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { basename, join, dirname } from 'path'
import { existsSync, readFileSync } from 'fs'
import type { KetQuaKyCong, KetQuaNgay, NhanVien, SuaTay } from '../core/types'
import { xuLyKyCong, tinhLaiMotDong, suaNgayCongTrucTiep, tinhLaiTongHop, tongToanKy } from '../core/xuLyKyCong'
import { khoangNgayMacDinh } from '../core/khoangNgayMacDinh'
import { dongBangKetQuaKy, mergePhatLuongCu, mapChuyenCan, coChuyenCanTuDong } from '../core/ketQuaKy'
import type { KetQuaKy } from '../core/ketQuaKy'
import { phutTrongNgay } from '../core/time'
import { docFileMay, LoiDocFileMay } from './excel/docFileMay'
import { docBangLuong, nhanVienTuBangLuong } from './excel/docBangLuong'
import { ghiBangLuong } from './excel/ghiBangLuong'
import { duongDanMauBangLuong } from './excel/mauBangLuong'
import { ghiChiTietDaLamSach, ghiChiTietTuMocCham } from './excel/ghiChiTietDaLamSach'
import type { HienThi } from '../core/hienThi'
import type { CauHinhMayChamCong } from '../core/mayChamCong'
import { ipHopLe, congHopLe } from '../core/mayChamCong'
import { gomMocCham } from '../core/gomMocCham'
import type { MocChamTho } from '../core/gomMocCham'
import { dongBo as dongBoTuMay, LoiKetNoiMayChamCong } from './mayChamCong/ketNoi'
import {
  layNhanVien,
  layConfig,
  ghiConfig,
  layDanhSachKy,
  layMotKy,
  ghiMotKy,
  layLoiMigration,
  layHienThi,
  ghiHienThi,
  layCauHinhMay,
  ghiCauHinhMay,
  layNguonGanNhat,
  ghiNguonGanNhat
} from './settings/store'
import { themHoacSua, xoaNhanVien, tronTuFileKyTruoc, chuanTen } from './settings/nhanVien'
import { chuanHoaMa } from '../core/ma'
import { log } from './logger'

/** Kỳ đang tính lấy dữ liệu từ đâu — quyết định cách "làm mới sau khi Setup đổi" (§lamMoiKyHienTai)
 * và cách xuất file "chi tiết đã làm sạch" (chỉ nguồn 'file' có file gốc để nhân bản layout). */
type NguonKy =
  | { loai: 'file'; duongDan: string }
  | { loai: 'may'; ip: string; port: number; tu: string; den: string }

interface KyHienTai {
  nguon: NguonKy
  ky: KetQuaKyCong
  /** Các dòng người dùng đã sửa tay ở S3 — phát lại sau khi dựng lại kỳ (BH vòng 2). */
  suaTay: SuaTay[]
}

let kyHienTai: KyHienTai | null = null

function win(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
}

// Test seam (dogfood/e2e): Playwright không bấm được dialog OS gốc. Khi biến
// TSC_TEST_* được đặt, handler dùng luôn đường dẫn đó thay vì mở dialog.
// KHÔNG ảnh hưởng bản build phát hành (biến không bao giờ được đặt ở đó).
function duongDanTest(bien: string): string | null {
  // Guard: seam CHỈ sống trong bản chưa đóng gói (dev / harness). Bản .exe phát hành
  // luôn bỏ qua, kể cả khi biến TSC_TEST_* tình cờ có trong môi trường máy người dùng.
  if (app.isPackaged) return null
  const v = process.env[bien]
  return v && existsSync(v) ? v : null
}

// Test seam cho "Đồng bộ từ máy" (vòng 5) — dogfood/e2e không có máy ZKTeco-compatible thật.
// TSC_TEST_MOC_CHAM_JSON trỏ tới file JSON [{userId, timestamp}] thay cho dongBoTuMay();
// TSC_TEST_MAY_LOI ép nhánh lỗi kết nối. Cùng guard app.isPackaged như duongDanTest ở trên.
function mocChamThoTest(): MocChamTho[] | null {
  if (app.isPackaged) return null
  const f = process.env.TSC_TEST_MOC_CHAM_JSON
  if (!f || !existsSync(f)) return null
  try {
    const raw = JSON.parse(readFileSync(f, 'utf-8')) as { userId: string | number; timestamp: string }[]
    return raw.map((r) => ({ userId: r.userId, timestamp: new Date(r.timestamp) }))
  } catch {
    return null
  }
}

function loi(e: unknown) {
  if (e instanceof LoiDocFileMay) return { ok: false, loi: e.message, maLoi: e.ma }
  const raw = (e as Error)?.message || ''
  log.error('IPC', raw || 'lỗi không xác định', (e as Error)?.stack || '')
  // Map lỗi Node thô sang câu tiếng Việt nói được phải làm gì (CONVENTIONS §5) —
  // không đẩy đường dẫn nội bộ / message hệ thống ra UI.
  let than = 'Có lỗi khi xử lý. Thử lại; nếu vẫn lỗi, gửi file log qua nút "Góp ý / báo lỗi".'
  if (/EBUSY|EPERM|resource busy|being used by another process/i.test(raw))
    than = 'File đang được mở ở chương trình khác (thường là Excel). Đóng file đó rồi thử lại.'
  else if (/EACCES|permission denied/i.test(raw))
    than = 'Không có quyền ghi vào thư mục đã chọn. Chọn thư mục khác.'
  else if (/ENOENT|no such file/i.test(raw))
    than = 'Không tìm thấy file — có thể đã bị di chuyển hoặc đổi tên. Chọn lại file.'
  else if (/ENOSPC|no space/i.test(raw)) than = 'Ổ đĩa đầy — dọn bớt dung lượng rồi thử lại.'
  return { ok: false, loi: than }
}

function tenFileXuat(thang: string) {
  const t = thang.replace('-', ' tháng ').slice(-2) || thang
  return {
    bangLuong: `bang luong thang ${t}.xlsx`,
    chiTiet: `chi tiet cong thang ${t} (da lam sach).xlsx`
  }
}

export function dangKyIpc(): void {
  ipcMain.handle('trang-thai', () => {
    const c = layConfig()
    return {
      soNhanVien: layNhanVien().length,
      kyXuLyGanNhat: c.kyXuLyGanNhat,
      thuMucXuatGanNhat: c.thuMucXuatGanNhat,
      fileMauBangLuongGanNhat: c.fileMauBangLuongGanNhat,
      loiMigration: layLoiMigration()
    }
  })

  ipcMain.handle('nhan-vien:danh-sach', () => layNhanVien())

  ipcMain.handle('file-may:chon-va-nap', async () => {
    try {
      let duongDan = duongDanTest('TSC_TEST_FILE_MAY')
      if (!duongDan) {
        const w = win()
        const r = await dialog.showOpenDialog(w!, {
          title: 'Chọn file máy chấm công (.xlsx)',
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
          properties: ['openFile']
        })
        if (r.canceled || !r.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn file.' }
        duongDan = r.filePaths[0]
      }
      const file = await docFileMay(duongDan)
      const ky = xuLyKyCong(file, layNhanVien())
      kyHienTai = { nguon: { loai: 'file', duongDan }, ky, suaTay: [] }
      ghiConfig({ kyXuLyGanNhat: file.thang })
      ghiNguonGanNhat({ loai: 'file', duongDan })
      luuTuDong()
      log.info('nạp file máy', duongDan, `${file.khoi.length} khối`)
      log.event('nap-file-may', {
        thang: file.thang,
        soKhoi: file.khoi.length,
        thieuSetup: ky.thieuSetup.length,
        dongCanXemLai: ky.tongDongCanXemLai
      })
      return { ok: true, data: { ky, fileMay: duongDan } }
    } catch (e) {
      return loi(e)
    }
  })

  ipcMain.handle('nhan-vien:them-sua', async (_e, nv: Partial<NhanVien>) => {
    const r = themHoacSua(nv)
    if (!r.ok) return { ok: false, loi: 'Dữ liệu chưa hợp lệ.', loiTruong: r.loi }
    const lm = await lamMoiKyHienTai()
    return { ok: true, data: r.nhanVien, ky: layKyHienTai(), canhBaoLamMoi: lm.loi }
  })

  ipcMain.handle('nhan-vien:xoa', async (_e, p: { id: string; xacNhan?: boolean }) => {
    const nv = layNhanVien().find((n) => n.id === p.id)
    if (!nv) return { ok: false, loi: 'Không tìm thấy nhân viên.' }
    // Cảnh báo nếu người này đang có trong kỳ vừa nạp —
    // và luôn đòi xác nhận (xoá cứng, mất ngưỡng + đơn giá đã khai — BH-3).
    const trongKy = kyHienTai?.ky.tongHop.some((t) => t.maNhanVien === nv.maNhanVien)
    if (!p.xacNhan) {
      return {
        ok: false,
        canXacNhanXoa: {
          ten: nv.tenMay,
          trongKy: !!trongKy,
          loi: trongKy
            ? `"${nv.tenMay}" đang có trong kỳ vừa nạp. Xoá sẽ mất ngưỡng giờ + đơn giá đã khai và chặn xuất tới khi khai lại.`
            : `Xoá "${nv.tenMay}" khỏi Setup? Ngưỡng giờ + đơn giá đã khai sẽ mất.`
        }
      }
    }
    const ds = xoaNhanVien(p.id)
    const lm = await lamMoiKyHienTai()
    log.info('xoá nhân viên', nv.maNhanVien, nv.tenMay)
    return { ok: true, data: ds, ky: layKyHienTai(), canhBaoLamMoi: lm.loi }
  })

  ipcMain.handle('ky-cong:hien-tai', () => layKyHienTai())

  ipcMain.handle('nhan-vien:nap-tu-file-ky-truoc', async () => {
    try {
      let duongDan = duongDanTest('TSC_TEST_FILE_KY_TRUOC')
      if (!duongDan) {
        const w = win()
        const r = await dialog.showOpenDialog(w!, {
          title: 'Chọn file bảng lương kỳ trước',
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
          properties: ['openFile']
        })
        if (r.canceled || !r.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn file.' }
        duongDan = r.filePaths[0]
      }
      const { doc } = await docBangLuong(duongDan)
      const rut = nhanVienTuBangLuong(doc)
      if (rut.length === 0)
        return { ok: false, loi: 'Không rút được nhân viên nào từ file — kiểm tra đúng là file bảng lương.' }
      // Thẻ không có cột mã VÀ tên không khớp ai đã khai → không tạo được người mới (thiếu mã).
      const tenDaKhai = new Set(layNhanVien().map((n) => chuanTen(n.tenBangLuong)))
      const thieuMa = rut.filter(
        (x) => !chuanHoaMa(x.maNhanVien) && !tenDaKhai.has(chuanTen(x.tenBangLuong))
      )
      const ds = tronTuFileKyTruoc(rut)
      const lm = await lamMoiKyHienTai()
      log.info('nạp nhân viên từ file kỳ trước', `${rut.length} thẻ, ${thieuMa.length} thiếu mã`)
      let canhBao = lm.loi
      if (thieuMa.length > 0 && !canhBao)
        canhBao = `File bảng lương này không có cột mã nhân viên — ${thieuMa.length} thẻ (${thieuMa
          .map((x) => x.tenBangLuong)
          .filter(Boolean)
          .join(', ')}) chưa khớp ai trong Setup, cần thêm tay kèm mã. ${ds.length} nhân viên hiện có.`
      return { ok: true, data: ds, ky: layKyHienTai(), canhBaoLamMoi: canhBao }
    } catch (e) {
      return loi(e)
    }
  })

  // Vòng 9 — payload là union: sửa giờ (`cap`, có từ vòng 1) HOẶC sửa thẳng "Ngày công"
  // (`r`, AC-2 vòng 9). Discriminate bằng khoá `r` — renderer chỉ bao giờ gửi đúng một
  // trong hai (S8: ô giờ onBlur → cap; select "Ngày công" onChange → r), không có ca
  // "gửi cả hai"/"gửi không cái nào" vì kiểu TypeScript ở preload/api-types.ts đã chặn.
  ipcMain.handle(
    'ky-cong:tinh-lai-ngay',
    (
      _e,
      p:
        | { maNhanVien: string; ngay: string; cap: { vao: string | null; ra: string | null }[] }
        | { maNhanVien: string; ngay: string; r: 0 | 0.5 | 1 }
    ) => {
      if (!kyHienTai) return { ok: false, loi: 'Chưa nạp kỳ công.' }
      const th = kyHienTai.ky.tongHop.find((t) => t.maNhanVien === p.maNhanVien)
      if (!th) return { ok: false, loi: 'Không tìm thấy nhân viên trong kỳ.' }
      const idx = th.ketQuaNgay.findIndex((d) => d.ngay === p.ngay)
      if (idx < 0) return { ok: false, loi: 'Không tìm thấy ngày.' }

      let dongMoi: KetQuaNgay
      let suaTayMoi: SuaTay
      if ('r' in p) {
        // Validate ở tầng main — TypeScript chỉ chặn compile-time (renderer luôn gửi đúng
        // 0/0.5/1 từ <select>), nhưng window.api gọi được trực tiếp qua DevTools console,
        // bỏ qua type-check. Giá trị lạ chảy thẳng vào thanhTien mà không lỗi là sai lương
        // im lặng — nặng nhất với app này (code review pha P1 vòng 9).
        if (p.r !== 0 && p.r !== 0.5 && p.r !== 1)
          return { ok: false, loi: 'Ngày công phải là 0, 0.5 hoặc 1.' }
        dongMoi = suaNgayCongTrucTiep(th.ketQuaNgay[idx], p.r)
        suaTayMoi = { loai: 'ngayCong', maNhanVien: p.maNhanVien, ngay: p.ngay, r: p.r }
      } else {
        // Validate định dạng giờ ở tầng main — ô rỗng thì cho qua, gõ sai thì chặn
        //.
        for (const c of p.cap) {
          for (const g of [c.vao, c.ra]) {
            if (g != null && g !== '' && phutTrongNgay(g) == null)
              return { ok: false, loi: `Giờ "${g}" không đúng dạng. Nhập dạng HH:MM, ví dụ 08:30. Để trống nếu không có.` }
          }
        }
        dongMoi = tinhLaiMotDong(th.ketQuaNgay[idx], p.cap, th.nguongGioChuanNgay)
        suaTayMoi = { loai: 'gio', maNhanVien: p.maNhanVien, ngay: p.ngay, cap: p.cap }
      }
      th.ketQuaNgay[idx] = dongMoi
      const thMoi = tinhLaiTongHop(th, th.ketQuaNgay)
      Object.assign(th, thMoi)
      capNhatTongKy()
      // Ghi lại để phát lại sau khi dựng lại kỳ (Setup đổi) — không mất chỉnh tay (BH vòng 2).
      kyHienTai.suaTay = kyHienTai.suaTay.filter(
        (s) => !(s.maNhanVien === p.maNhanVien && s.ngay === p.ngay)
      )
      kyHienTai.suaTay.push(suaTayMoi)
      luuTuDong()
      return { ok: true, data: { dong: dongMoi, tongHop: th } }
    }
  )

  ipcMain.handle('ky-cong:xuat', async (_e, p: { ghiDe: boolean }) => {
    try {
      if (!kyHienTai) return { ok: false, loi: 'Chưa nạp kỳ công.' }
      if (kyHienTai.ky.thieuSetup.length > 0) {
        log.event('xuat-that-bai', { ly_do: 'thieu-setup', so: kyHienTai.ky.thieuSetup.length })
        return { ok: false, loi: 'Còn nhân viên chưa khai Setup — khai đủ trước khi xuất.' }
      }

      const c = layConfig()
      const fileMau = duongDanMauBangLuong()
      if (!existsSync(fileMau))
        return {
          ok: false,
          loi: 'Không tìm thấy mẫu bảng lương nhúng sẵn trong app. Cài lại bản mới nếu lỗi vẫn còn.'
        }

      let thuMuc = duongDanTest('TSC_TEST_THU_MUC_XUAT')
      if (!thuMuc) {
        const w = win()
        const macDinh =
          c.thuMucXuatGanNhat ||
          (kyHienTai.nguon.loai === 'file' ? dirname(kyHienTai.nguon.duongDan) : undefined)
        const rDir = await dialog.showOpenDialog(w!, {
          title: 'Chọn thư mục lưu 2 file kết quả',
          ...(macDinh ? { defaultPath: macDinh } : {}),
          properties: ['openDirectory', 'createDirectory']
        })
        if (rDir.canceled || !rDir.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn thư mục.' }
        thuMuc = rDir.filePaths[0]
      }

      const ten = tenFileXuat(kyHienTai.ky.thang)
      const pBL = join(thuMuc, ten.bangLuong)
      const pCT = join(thuMuc, ten.chiTiet)

      if (!p.ghiDe) {
        const trung = [pBL, pCT].filter((x) => existsSync(x)).map((x) => basename(x))
        if (trung.length) return { ok: false, canXacNhanGhiDe: trung }
      }

      // Vòng 6 (AC-5) — 5 khoản phát lương chỉ tồn tại trên kỳ ĐÃ lưu (nhập ở S10); kỳ đang
      // xuất chưa từng "Lưu kỳ này" → không có, giữ nguyên bộ ô trống trong mẫu (challenge
      // pha I 2026-09-05 log).
      const kqDaLuu = layMotKy(kyHienTai.ky.thang)
      const bl = await ghiBangLuong(
        fileMau,
        pBL,
        kyHienTai.ky.tongHop,
        { ngayBatDau: kyHienTai.ky.ngayBatDau, ngayKetThuc: kyHienTai.ky.ngayKetThuc },
        kqDaLuu
          ? {
              chuyenCan: mapChuyenCan(kqDaLuu),
              buLuong: kqDaLuu.buLuong,
              le: kqDaLuu.le,
              baoHiem: kqDaLuu.baoHiem,
              khauTru: kqDaLuu.khauTru
            }
          : undefined
      )
      let ct: { duongDanRa: string; soDongToVang: number }
      try {
        ct =
          kyHienTai.nguon.loai === 'file'
            ? await ghiChiTietDaLamSach(kyHienTai.nguon.duongDan, pCT, kyHienTai.ky.tongHop)
            : await ghiChiTietTuMocCham(pCT, kyHienTai.ky.tongHop)
      } catch (e) {
        // Bảng lương đã ghi xong, file chi tiết lỗi → nói rõ trạng thái từng file (BH-12).
        const r = loi(e)
        return { ...r, loi: `Đã ghi xong "${ten.bangLuong}". Nhưng "${ten.chiTiet}": ${r.loi} Bấm Xuất lại để ghi nốt file chi tiết.` }
      }
      ghiConfig({ thuMucXuatGanNhat: thuMuc })
      log.info('xuất', thuMuc, `${bl.daGhi.length} thẻ lương, ${ct.soDongToVang} dòng vàng`)
      log.event('xuat-hoan-tat', {
        thang: kyHienTai.ky.thang,
        theLuong: bl.daGhi.length,
        theKhongKhop: bl.khongKhop.length,
        theGiuSoCu: bl.theGiuSoCu.length,
        theThemMoi: bl.theThemMoi.length,
        dongToVang: ct.soDongToVang
      })

      return {
        ok: true,
        data: {
          bangLuong: {
            duongDan: pBL,
            daGhi: bl.daGhi.length,
            khongKhop: bl.khongKhop,
            theGiuSoCu: bl.theGiuSoCu,
            theThemMoi: bl.theThemMoi
          },
          chiTiet: { duongDan: pCT, soDongToVang: ct.soDongToVang },
          thuMuc
        }
      }
    } catch (e) {
      return loi(e)
    }
  })

  ipcMain.handle('mo-thu-muc', (_e, duongDan: string) => {
    // Chỉ mở thư mục công cụ vừa ghi vào (renderer không mở đường dẫn tuỳ ý — REV).
    const choPhep = layConfig().thuMucXuatGanNhat
    if (!duongDan || duongDan !== choPhep || !existsSync(duongDan)) return
    shell.openPath(duongDan)
  })

  // Mốc "đã mở màn Xem công" — tín hiệu hỗ trợ cho success metric vòng 2.
  // KHÔNG suy trực tiếp "không mở Excel" từ đây: người dùng vẫn xuất file mỗi kỳ để gửi đi
  // (S6 là đường phụ, không bỏ), nên `xuat-hoan-tat` bắn mỗi kỳ. Metric thật đo bằng
  // người dùng tự báo; event này chỉ cho
  // thấy S7 CÓ được dùng và tần suất.
  ipcMain.handle('ky-cong:danh-dau-xem-cong', () => {
    if (!kyHienTai) return
    log.event('xem-cong-s7', {
      thang: kyHienTai.ky.thang,
      soNhanVien: kyHienTai.ky.tongHop.length,
      tongThanhTien: kyHienTai.ky.tongThanhTienCaKy
    })
  })

  // Kênh phản hồi trong sản phẩm. Địa chỉ cố định ở main —
  // renderer không truyền URL vào (tránh mở link tuỳ ý).
  ipcMain.handle('mo-gop-y', () => {
    const tieuDe = encodeURIComponent('Góp ý / báo lỗi — Timesheet Calculator')
    shell.openExternal(`mailto:feedback@example.com?subject=${tieuDe}`)
  })

  // ---- Vòng 4 — thiết lập Hiển thị (cỡ chữ/độ cao hàng/nền/tương phản) ----
  ipcMain.handle('hien-thi:doc', () => layHienThi())
  ipcMain.handle('hien-thi:cap-nhat', (_e, patch: Partial<HienThi>) => {
    try {
      return ghiHienThi(patch)
    } catch (e) {
      log.error('ghi thiết lập hiển thị', (e as Error)?.message || '', (e as Error)?.stack || '')
      throw e
    }
  })

  // ---- Vòng 5 — kết nối máy chấm công vân tay (LAN) ----
  ipcMain.handle('may-cham-cong:doc-cau-hinh', () => layCauHinhMay())
  ipcMain.handle('may-cham-cong:cap-nhat-cau-hinh', (_e, patch: Partial<CauHinhMayChamCong>) => {
    try {
      return ghiCauHinhMay(patch)
    } catch (e) {
      log.error('ghi cấu hình máy chấm công', (e as Error)?.message || '', (e as Error)?.stack || '')
      throw e
    }
  })

  ipcMain.handle(
    'may-cham-cong:dong-bo',
    async (_e, p: { ip: string; port: number; tu: string; den: string }) => {
      try {
        const ip = String(p?.ip ?? '').trim()
        const port = Number(p?.port)
        if (!ipHopLe(ip))
          return { ok: false, loi: 'Địa chỉ IP không đúng dạng (ví dụ: 192.0.2.201).' }
        if (!congHopLe(port)) return { ok: false, loi: 'Cổng phải là số từ 1 đến 65535.' }
        // Lưu cấu hình NGAY, kể cả khi kết nối bên dưới thất bại — IP/cổng đã gõ không mất (AC-3).
        ghiCauHinhMay({ ip, port })

        let logTho = mocChamThoTest()
        if (!logTho) {
          if (!app.isPackaged && process.env.TSC_TEST_MAY_LOI) {
            throw new LoiKetNoiMayChamCong(
              'Không kết nối được máy chấm công — kiểm tra lại địa chỉ mạng hoặc dùng Chọn file.'
            )
          }
          logTho = await dongBoTuMay(ip, port)
        }

        const { file, canhBao } = gomMocCham(logTho, p.tu, p.den)
        const ky = xuLyKyCong(file, layNhanVien())
        kyHienTai = { nguon: { loai: 'may', ip, port, tu: p.tu, den: p.den }, ky, suaTay: [] }
        ghiConfig({ kyXuLyGanNhat: file.thang })
        ghiNguonGanNhat({ loai: 'may', ip, port })
        luuTuDong()
        log.info('đồng bộ từ máy chấm công', ip, `${file.khoi.length} người, ${logTho.length} mốc`)
        log.event('dong-bo-may-cham-cong', {
          thang: file.thang,
          soNguoi: file.khoi.length,
          thieuSetup: ky.thieuSetup.length,
          soMoc: logTho.length,
          canhBao: canhBao.length
        })
        return {
          ok: true,
          data: { ky, fileMay: `may-cham-cong://${ip}:${port}` },
          canhBao: canhBao.length ? canhBao : undefined
        }
      } catch (e) {
        if (e instanceof LoiKetNoiMayChamCong) return { ok: false, loi: e.message }
        return loi(e)
      }
    }
  )

  // ---- Vòng 7 — tự động nạp/đồng bộ nguồn gần nhất khi mở app (AC-1) ----
  ipcMain.handle('nguon-gan-nhat:doc', () => layNguonGanNhat())

  ipcMain.handle('nguon-gan-nhat:tu-dong-nap', async () => {
    // Đang có kỳ mở dở dang (module vừa dựng lại trong tiến trình này) → không tự động,
    // an toàn dữ liệu thắng tiện lợi. Ở app thật mới mở tiến
    // trình, kyHienTai luôn null tại đây — guard này chỉ phòng hờ.
    if (kyHienTai) return { ok: false, loi: 'Đang có kỳ mở dở dang.' }
    const nguon = layNguonGanNhat()
    if (!nguon) return { ok: false, loi: 'Chưa từng nạp/đồng bộ lần nào.' }
    try {
      if (nguon.loai === 'file') {
        if (!existsSync(nguon.duongDan))
          return {
            ok: false,
            loi: `Không tìm thấy file cũ (${nguon.duongDan}) — có thể đã bị xoá hoặc đổi chỗ.`
          }
        const file = await docFileMay(nguon.duongDan)
        // Đọc file/mạng là bất đồng bộ — trong lúc chờ, người dùng có thể đã tự tay nạp
        // kỳ khác qua S1 (thấy Dashboard vẫn dùng được, không biết auto-nap đang chạy nền).
        // Re-check TRƯỚC khi ghi đè: kỳ tay luôn thắng, không để auto-nap đè lên sau
        // (soi bug pha P vòng 7 — TOCTOU, cùng nguyên tắc "an toàn dữ liệu thắng tiện lợi").
        if (kyHienTai) return { ok: false, loi: 'Đã có kỳ khác được nạp trong lúc chờ.' }
        const ky = xuLyKyCong(file, layNhanVien())
        // Vòng 8 — tái áp dụng sửa tay đã lưu từ phiên trước (persist trong `KetQuaKy.suaTay`,
        // phiên cũ đã đóng nên không còn gì ở bộ nhớ tiến trình để đọc như `lamMoiKyHienTai`).
        const suaTayCu = layMotKy(file.thang)?.suaTay ?? []
        const conHieuLuc = apDungSuaTay(ky, suaTayCu)
        kyHienTai = { nguon: { loai: 'file', duongDan: nguon.duongDan }, ky, suaTay: conHieuLuc }
        ghiConfig({ kyXuLyGanNhat: file.thang })
        ghiNguonGanNhat({ loai: 'file', duongDan: nguon.duongDan })
        luuTuDong()
        log.info('tự động nạp lại file (mở app)', nguon.duongDan)
        return { ok: true, data: { ky, fileMay: nguon.duongDan } }
      }
      const { tu, den } = khoangNgayMacDinh(new Date())
      let logTho = mocChamThoTest()
      if (!logTho) {
        if (!app.isPackaged && process.env.TSC_TEST_MAY_LOI) {
          throw new LoiKetNoiMayChamCong('Không kết nối được máy chấm công.')
        }
        logTho = await dongBoTuMay(nguon.ip, nguon.port)
      }
      // Cùng re-check TOCTOU như nhánh 'file' ở trên — đồng bộ máy còn chờ lâu hơn (timeout
      // 5s), càng nhiều thời gian để người dùng tự tay nạp cái khác trong lúc chờ.
      if (kyHienTai) return { ok: false, loi: 'Đã có kỳ khác được nạp trong lúc chờ.' }
      // canhBao (mốc dư bị bỏ, v.v.) không được nuốt im lặng — nhánh nạp tay (may-cham-cong:dong-bo)
      // đã trả cho renderer hỏi xác nhận; nhánh tự động không thể hỏi (không chặn UI
      // §7 bước 0), nhưng vẫn phải trả về để renderer hiện banner thông tin (soi bug pha P vòng 7).
      const { file, canhBao } = gomMocCham(logTho, tu, den)
      const ky = xuLyKyCong(file, layNhanVien())
      const suaTayCu = layMotKy(file.thang)?.suaTay ?? []
      const conHieuLuc = apDungSuaTay(ky, suaTayCu)
      kyHienTai = {
        nguon: { loai: 'may', ip: nguon.ip, port: nguon.port, tu, den },
        ky,
        suaTay: conHieuLuc
      }
      ghiConfig({ kyXuLyGanNhat: file.thang })
      ghiNguonGanNhat({ loai: 'may', ip: nguon.ip, port: nguon.port })
      luuTuDong()
      log.info('tự động đồng bộ từ máy (mở app)', nguon.ip, canhBao.length ? `${canhBao.length} cảnh báo` : '')
      return {
        ok: true,
        data: { ky, fileMay: `may-cham-cong://${nguon.ip}:${nguon.port}` },
        canhBao: canhBao.length ? canhBao : undefined
      }
    } catch (e) {
      if (e instanceof LoiKetNoiMayChamCong) return { ok: false, loi: e.message }
      return loi(e)
    }
  })

  // ---- Vòng 3 — dashboard + phát lương (vòng 8: hết "Lưu kỳ này", auto-lưu qua luuTuDong()) ----

  ipcMain.handle('ky-luu:danh-sach', () => layDanhSachKy())

  ipcMain.handle('ky-luu:doc', (_e, thang: string) => {
    const kq = layMotKy(thang)
    // Mốc "tra cứu kỳ đã lưu trong app" — tín hiệu hỗ trợ cho success metric vòng 3
    //. Metric thật đo
    // bằng người dùng tự báo; event này chỉ cho thấy màn Phát lương CÓ được dùng.
    if (kq) log.event('doc-ky-da-luu', { thang })
    return kq
  })

  // Fire-and-forget: người dùng bấm "In danh sách" ở S10 (window.print ở renderer).
  ipcMain.handle('ky-luu:danh-dau-in', (_e, p: { thang: string; soNguoi: number }) => {
    log.event('in-danh-sach-phat-luong', { thang: p?.thang, soNguoi: p?.soNguoi })
  })

  // Cập nhật khấu trừ / đã-trả / 4 khoản phát lương (vòng 6) một nhân viên trong một kỳ đã lưu.
  ipcMain.handle(
    'ky-luu:cap-nhat-phat-luong',
    (
      _e,
      p: {
        thang: string
        maNhanVien: string
        khauTru?: number
        daTra?: boolean
        /** null = bỏ số nhập tay, quay về tự tính theo ngày công. */
        chuyenCan?: number | null
        buLuong?: number
        le?: number
        baoHiem?: number
      }
    ) => {
      const kq: KetQuaKy | null = layMotKy(p.thang)
      if (!kq) return { ok: false, loi: 'Không tìm thấy kỳ đã lưu.' }
      if (!kq.dongBang.some((d) => d.maNhanVien === p.maNhanVien))
        return { ok: false, loi: 'Nhân viên không có trong kỳ này.' }
      // Chốt cờ tự tính trước khi đổi daTra — kỳ cũ thiếu cờ không bị tắt tự tính giữa chừng
      // chỉ vì vừa tick người đầu tiên.
      kq.chuyenCanTuDong = coChuyenCanTuDong(kq)
      if (p.chuyenCan === null) {
        const cc = { ...(kq.chuyenCan ?? {}) }
        delete cc[p.maNhanVien]
        kq.chuyenCan = cc
        const tay = { ...(kq.chuyenCanSuaTay ?? {}) }
        delete tay[p.maNhanVien]
        kq.chuyenCanSuaTay = tay
      } else if (p.chuyenCan !== undefined) {
        kq.chuyenCanSuaTay = { ...(kq.chuyenCanSuaTay ?? {}), [p.maNhanVien]: true }
      }

      if (p.khauTru !== undefined) {
        const k = Number(p.khauTru)
        if (!Number.isFinite(k) || k < 0)
          return { ok: false, loi: 'Vay phải là số không âm.' }
        kq.khauTru = { ...kq.khauTru, [p.maNhanVien]: Math.round(k) }
      }
      if (p.daTra !== undefined) {
        kq.daTra = { ...kq.daTra, [p.maNhanVien]: !!p.daTra }
      }
      // Vòng 6 — 4 khoản mới, cùng luật validate ≥ 0.
      const KHOAN_MOI = [
        ['chuyenCan', 'Chuyên cần'],
        ['buLuong', 'Bù lương'],
        ['le', 'Lễ'],
        ['baoHiem', 'Bảo hiểm']
      ] as const
      for (const [truong, nhan] of KHOAN_MOI) {
        const v = p[truong]
        if (v === undefined || v === null) continue
        const n = Number(v)
        if (!Number.isFinite(n) || n < 0) return { ok: false, loi: `${nhan} phải là số không âm.` }
        kq[truong] = { ...(kq[truong] ?? {}), [p.maNhanVien]: Math.round(n) }
      }
      ghiMotKy(kq)
      return { ok: true, data: kq }
    }
  )
}

/**
 * Vòng 8 — ghi kỳ đang mở (`kyHienTai`) vào lịch sử NGAY, mỗi khi tính (nạp file/đồng bộ/tự
 * động nạp) hoặc sửa tay. Thay cho nút "Lưu kỳ này" (vòng 3–7) — người dùng chốt bỏ hẳn qua
 * chat 2026-09-07. Đóng băng đơn giá
 * (vòng 6) vẫn đúng — chỉ đổi THỜI ĐIỂM kích hoạt sang lúc tính/sửa thay vì lúc bấm lưu.
 * Không hỏi xác nhận ghi đè: `mergePhatLuongCu` đã giữ khauTru/daTra/4 khoản cho mã còn khớp,
 * số công/OT/thành tiền được thay bằng số vừa tính là đúng ý "nạp lại" (không phải mất mát).
 */
function luuTuDong(): KetQuaKy | null {
  if (!kyHienTai) return null
  const thang = kyHienTai.ky.thang
  const cu = layMotKy(thang)
  const kq = mergePhatLuongCu(
    dongBangKetQuaKy(kyHienTai.ky, kyHienTai.ky.tongHop, new Date().toISOString()),
    cu
  )
  kq.suaTay = kyHienTai.suaTay
  kq.thieuSetup = kyHienTai.ky.thieuSetup
  ghiMotKy(kq)
  return kq
}

/**
 * Phát lại các chỗ đã sửa tay lên một `KetQuaKyCong` vừa dựng lại từ nguồn thô (khớp
 * maNhanVien + ngay). Bỏ entry nào không còn khớp (nhân viên bị xoá / ngày không còn) —
 * không ném. Dùng chung cho `lamMoiKyHienTai` (Setup đổi, suaTay lấy từ bộ nhớ phiên) và
 * `nguon-gan-nhat:tu-dong-nap` (vòng 8: suaTay lấy từ đĩa, phiên trước đã đóng).
 */
/** Shape của `SuaTay` trên đĩa TRƯỚC vòng 9 — không có `loai` (chỉ loại "sửa giờ" từng tồn tại). */
type SuaTayCu = { maNhanVien: string; ngay: string; cap: { vao: string | null; ra: string | null }[] }

function apDungSuaTay(ky: KetQuaKyCong, suaTay: SuaTay[]): SuaTay[] {
  const conHieuLuc: SuaTay[] = []
  for (const s0 of suaTay) {
    // Vòng 9: bản ghi trên đĩa TỪ TRƯỚC vòng 9 không có `loai` — coi như 'gio', không
    // migrate dữ liệu.
    const s: SuaTay = 'loai' in s0 ? s0 : { ...(s0 as SuaTayCu), loai: 'gio' }
    const th = ky.tongHop.find((t) => t.maNhanVien === s.maNhanVien)
    if (!th) continue
    const idx = th.ketQuaNgay.findIndex((d) => d.ngay === s.ngay)
    if (idx < 0) continue
    th.ketQuaNgay[idx] =
      s.loai === 'ngayCong'
        ? suaNgayCongTrucTiep(th.ketQuaNgay[idx], s.r)
        : tinhLaiMotDong(th.ketQuaNgay[idx], s.cap, th.nguongGioChuanNgay)
    Object.assign(th, tinhLaiTongHop(th, th.ketQuaNgay))
    conHieuLuc.push(s)
  }
  Object.assign(ky, tongToanKy(ky.tongHop))
  return conHieuLuc
}

/**
 * Sau khi Setup đổi → tính lại kỳ đang mở (nếu có) để AC-6 phản ánh ngay.
 * Đọc lại file máy thất bại (file bị di chuyển/khoá) → KHÔNG nuốt lỗi: trả cảnh báo
 * để renderer báo người dùng nạp lại, thay vì hành động trên kỳ cũ.
 */
async function lamMoiKyHienTai(): Promise<{ loi?: string }> {
  if (!kyHienTai) return {}
  const nguon = kyHienTai.nguon
  try {
    const file =
      nguon.loai === 'file'
        ? await docFileMay(nguon.duongDan)
        : gomMocCham(
            mocChamThoTest() ?? (await dongBoTuMay(nguon.ip, nguon.port)),
            nguon.tu,
            nguon.den
          ).file
    const ky = xuLyKyCong(file, layNhanVien())
    const conHieuLuc = apDungSuaTay(ky, kyHienTai.suaTay)
    kyHienTai = { nguon, ky, suaTay: conHieuLuc }
    luuTuDong()
    return {}
  } catch (e) {
    log.error('làm mới kỳ', (e as Error).message)
    return {
      loi:
        nguon.loai === 'file'
          ? 'Đã lưu Setup, nhưng không đọc lại được file máy chấm công (có thể đã bị di chuyển hoặc đang mở ở Excel). Nạp lại file máy để cập nhật bảng tổng hợp.'
          : 'Đã lưu Setup, nhưng không kết nối lại được máy chấm công để cập nhật bảng tổng hợp. Bấm "Đồng bộ từ máy" lại khi máy sẵn sàng.'
    }
  }
}

function capNhatTongKy() {
  if (!kyHienTai) return
  Object.assign(kyHienTai.ky, tongToanKy(kyHienTai.ky.tongHop))
}

/** Cho renderer lấy lại kỳ hiện tại sau khi Setup thay đổi. */
export function layKyHienTai(): KetQuaKyCong | null {
  return kyHienTai?.ky ?? null
}
