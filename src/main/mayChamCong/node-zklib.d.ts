// node-zklib không phát hành .d.ts riêng — khai tối thiểu đúng phần API dùng ở ketNoi.ts
// (đối chiếu mã nguồn thật của gói, bản 1.3.0: zklib.js + zklibudp.js).
declare module 'node-zklib' {
  export default class ZKLib {
    constructor(ip: string, port: number, timeout: number, inport: number)
    createSocket(cbErr?: (err: Error) => void, cbClose?: (type: string) => void): Promise<void>
    getAttendances(cb?: (percent: number, total: number) => void): Promise<{
      data: { deviceUserId: number; recordTime: Date }[]
      err?: Error
    }>
    disconnect(): Promise<void>
  }
}
