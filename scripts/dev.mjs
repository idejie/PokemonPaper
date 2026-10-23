import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const bin = (name) => join(root, 'node_modules', '.bin', name)

const children = []

function run(command, args, label) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  })
  child.on('exit', (code) => {
    console.log(`[dev] ${label} exited with ${code}`)
    shutdown(code ?? 0)
  })
  children.push(child)
}

let closing = false
function shutdown(code = 0) {
  if (closing) return
  closing = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 150)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

if (!existsSync(bin('vite'))) {
  console.error('[dev] 还没安装依赖，先运行 pnpm install')
  process.exit(1)
}

console.log('[dev] API    http://127.0.0.1:8787')
console.log('[dev] Web    http://127.0.0.1:5173')

run(process.execPath, ['server/index.mjs'], 'api')
run(bin('vite'), ['--host', '127.0.0.1'], 'web')
