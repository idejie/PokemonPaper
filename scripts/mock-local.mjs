import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startMockGithub } from './mock-github.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const APP_URL = 'https://pokemonpaper.com:8787'
const CERT_DIR = join(ROOT, '.mock')
const CERT_KEY = join(CERT_DIR, 'pokemonpaper.key')
const CERT_CRT = join(CERT_DIR, 'pokemonpaper.crt')

if (!existsSync(CERT_KEY) || !existsSync(CERT_CRT)) {
  mkdirSync(CERT_DIR, { recursive: true })
  execFileSync(
    'openssl',
    [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', CERT_KEY, '-out', CERT_CRT,
      '-days', '30', '-subj', '/CN=pokemonpaper.com',
      '-addext', 'subjectAltName=DNS:pokemonpaper.com',
    ],
    { stdio: 'ignore' },
  )
  console.log('[mock] generated self-signed cert in .mock/')
}
const MOCK_PORT = 9997
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Iv23li0RFdl11YG1AoGe'

const mock = await startMockGithub(MOCK_PORT).catch((err) => {
  console.error(`[mock] cannot listen on ${MOCK_PORT}: ${err.message}`)
  process.exit(1)
})
console.log(`[mock] GitHub OAuth -> http://127.0.0.1:${MOCK_PORT}`)

const app = spawn(process.execPath, ['server/index.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    PUBLIC_URL: APP_URL,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: 'mock-local-secret',
    GITHUB_OAUTH_BASE: `http://127.0.0.1:${MOCK_PORT}`,
    GITHUB_API_BASE: `http://127.0.0.1:${MOCK_PORT}`,
    HTTPS_KEY: CERT_KEY,
    HTTPS_CERT: CERT_CRT,
  },
})

const stop = () => {
  app.kill('SIGTERM')
  mock.close()
}
process.on('SIGINT', () => {
  stop()
  process.exit(0)
})
process.on('SIGTERM', () => {
  stop()
  process.exit(0)
})
app.on('exit', (code) => {
  mock.close()
  process.exit(code ?? 0)
})

console.log(`[mock] app -> ${APP_URL}`)
console.log('[mock] open Chrome with:')
console.log(
  `  open -na "Google Chrome" --args --host-resolver-rules="MAP pokemonpaper.com 127.0.0.1" --ignore-certificate-errors --proxy-server=direct:// --proxy-bypass-list=* --user-data-dir=/tmp/pokemonpaper-mock "${APP_URL}"`,
)
console.log('[mock] or run: ./scripts/open-mock-chrome.sh')
