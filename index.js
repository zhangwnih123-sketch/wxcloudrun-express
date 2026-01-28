const http = require('http')
const https = require('https')
const { URL } = require('url')

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

function postJSON(url, obj) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const body = Buffer.from(JSON.stringify(obj))
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length
      }
    }
    const req = https.request(opts, res => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => {
        try { resolve(JSON.parse(d)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/health') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('ok')
    return
  }

  if (req.method === 'POST' && url.pathname === '/gemini') {
    try {
      const geminiKey = process.env.GEMINI_API_KEY || ''
      if (!geminiKey) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: { message: 'MISSING_GEMINI_API_KEY' } }))
        return
      }
      const body = await readJSON(req)
      const contents = Array.isArray(body && body.contents) ? body.contents : []
      const payload = { ...body, contents }
      const api = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(geminiKey)
      const out = await postJSON(api, payload)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(out))
    } catch (e) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: { message: 'SERVER_ERROR' } }))
    }
    return
  }

  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: { message: 'NOT_FOUND' } }))
})

const port = parseInt(process.env.PORT, 10) || 8080
server.listen(port)
