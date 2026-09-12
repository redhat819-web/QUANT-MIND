import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/**
 * GitHub Pages(https://<user>.github.io/QUANT-MIND/) 같은 서브 경로 배포에서는
 * 서비스 워커가 기본 경로(도메인 루트 '/mockServiceWorker.js')에 없다.
 * Vite의 BASE_URL(vite.config.ts base와 동일)을 그대로 사용해 실제 배포 경로를
 * 가리키도록 한다.
 */
export const mockServiceWorkerOptions = {
  serviceWorker: {
    url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
  },
}
