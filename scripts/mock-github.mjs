import { createServer } from 'node:http'

/**
 * Tiny GitHub OAuth mock for local development.
 * - /login/oauth/authorize -> redirects back to redirect_uri with code + state
 * - /login/oauth/access_token -> returns a fake token
 * - /user -> returns a fake profile
 */
export function startMockGithub(port = 9997) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
    if (url.pathname === '/login/oauth/authorize') {
      const redirect = url.searchParams.get('redirect_uri')
      if (!redirect) {
        res.writeHead(400, { 'content-type': 'text/plain' })
        return res.end('missing redirect_uri')
      }
      const target = new URL(redirect)
      target.searchParams.set('code', 'mock-code')
      target.searchParams.set('state', url.searchParams.get('state') || '')
      res.writeHead(302, { location: target.toString() })
      return res.end()
    }
    if (url.pathname === '/login/oauth/access_token') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(
        JSON.stringify({
          access_token: 'mock-access-token',
          token_type: 'bearer',
          scope: 'read:user',
        }),
      )
    }
    if (url.pathname === '/user') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(
        JSON.stringify({
          id: 424242,
          login: 'mock-octocat',
          name: 'Mock Octocat',
          avatar_url: 'https://github.com/octocat.png',
        }),
      )
    }
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startMockGithub().then(() => console.log('[mock] GitHub OAuth on http://127.0.0.1:9997'))
}
