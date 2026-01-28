const express = require('express')
const app = express()
const https = require('https')

app.use(express.json())

function postJSON(url, json) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const data = Buffer.from(JSON.stringify(json))
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }
    const req = https.request(opts, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve(JSON.parse(d)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

app.get('/', (req, res) => res.send('ok'))
app.get('/health', (req, res) => res.send('ok'))

app.post('/gemini', async (req, res) => {
  try {
    const geminiKey = process.env.GEMINI_API_KEY
    const body = req.body || {}
    const orig = Array.isArray(body.contents) ? body.contents : []
    body.contents = orig
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(geminiKey || '')}`
    const out = await postJSON(url, body)
    res.status(200).json(out)
  } catch (e) {
    res.status(500).json({ error: { message: 'SERVER_ERROR' } })
  }
})

const port = parseInt(process.env.PORT || '80', 10)
app.listen(port)
