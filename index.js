const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const axios = require('axios')

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(cors())
app.use(morgan('tiny'))

async function requestWithRetry(url, data, options = {}) {
  const timeout = options.timeoutMs || 5000
  const retries = options.retries ?? 2
  const backoff = options.backoffMs || 1000
  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await axios.post(url, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout
      })
      return res.data
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED'
      const isNetwork = !err.response
      const status = err.response?.status
      const isRetryable = isTimeout || isNetwork || (status && status >= 500)
      if (attempt >= retries || !isRetryable) {
        const e = new Error(isTimeout ? 'UPSTREAM_TIMEOUT' : isNetwork ? 'UPSTREAM_NETWORK_ERROR' : 'UPSTREAM_ERROR')
        e.status = status || (isTimeout ? 504 : isNetwork ? 502 : 502)
        e.details = err.response?.data || err.message
        throw e
      }
      await new Promise(r => setTimeout(r, backoff * Math.pow(2, attempt)))
      attempt++
    }
  }
}

app.get('/', (req, res) => res.send('ok'))
app.get('/health', (req, res) => res.send('ok'))

app.post('/gemini', async (req, res) => {
  try {
    const { contents, generationConfig } = req.body || {}
    const apiKey = process.env.GEMINI_API_KEY
    const proxyHost = (process.env.PROXY_HOST || 'https://api.niubi.win').replace(/\/+$/, '')
    const model = process.env.MODEL_NAME || 'gemini-2.0-flash'
    if (!apiKey) {
      res.status(500).json({ error: 'MISSING_GEMINI_API_KEY' })
      return
    }
    const targetUrl = `${proxyHost}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    const payload = { contents, generationConfig: { ...(generationConfig || {}) } }
    const data = await requestWithRetry(targetUrl, payload, { timeoutMs: 60000, retries: 2, backoffMs: 800 })
    res.json(data)
  } catch (error) {
    const status = error.status || 500
    res.status(status).json({ error: error.message || 'SERVER_ERROR', details: error.details || '' })
  }
})

const port = parseInt(process.env.PORT || '80', 10)
app.listen(port)
