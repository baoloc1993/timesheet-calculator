import type { Api } from './api-types'

declare global {
  interface Window {
    api: Api
  }
}

export {}
