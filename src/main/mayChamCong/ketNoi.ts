// Kết nối LAN tới máy chấm công vân tay (ZKTeco-compatible, giao thức kiểu ZKTeco qua node-zklib).
// Chỗ DUY NHẤT dùng node-zklib và mở socket ra ngoài tiến trình.
// Không giữ kết nối mở giữa hai lần gọi: mở → lấy → đóng, mỗi lần bấm "Kết nối & lấy dữ liệu".

import ZKLib from 'node-zklib'
import type { MocChamTho } from '../../core/gomMocCham'

const TIMEOUT_MS = 5000
const THONG_BAO_LOI =
  'Không kết nối được máy chấm công — kiểm tra lại địa chỉ mạng hoặc dùng Chọn file.'

export class LoiKetNoiMayChamCong extends Error {}

/** Chặn timeout tổng ở đây thay vì tin riêng timeout nội bộ của node-zklib (createSocket
 * thử TCP rồi mới rơi xuống UDP — cộng dồn có thể vượt 5s nếu chỉ dựa vào lib). */
function coGioiHan<T>(p: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new LoiKetNoiMayChamCong(THONG_BAO_LOI)), TIMEOUT_MS)
    p.then(
      (v) => {
        clearTimeout(id)
        resolve(v)
      },
      (e) => {
        clearTimeout(id)
        reject(e)
      }
    )
  })
}

async function layLogTho(zk: ZKLib): Promise<{ deviceUserId: number; recordTime: Date }[]> {
  await zk.createSocket()
  const { data } = await zk.getAttendances()
  return data || []
}

/** Mở kết nối, lấy toàn bộ log máy còn giữ (không lọc theo ngày — lọc ở `core/gomMocCham`). */
export async function dongBo(ip: string, port: number): Promise<MocChamTho[]> {
  // inport 0 = để hệ điều hành tự chọn cổng UDP nội bộ, tránh EADDRINUSE khi bấm liên tiếp.
  const zk = new ZKLib(ip, port, TIMEOUT_MS, 0)
  try {
    const raw = await coGioiHan(layLogTho(zk))
    return raw.map((r) => ({ userId: r.deviceUserId, timestamp: r.recordTime }))
  } catch (e) {
    if (e instanceof LoiKetNoiMayChamCong) throw e
    throw new LoiKetNoiMayChamCong(THONG_BAO_LOI)
  } finally {
    zk.disconnect().catch(() => {
      // đã lỗi/timeout từ trước hoặc socket chưa từng mở — bỏ qua, không che lỗi gốc
    })
  }
}
