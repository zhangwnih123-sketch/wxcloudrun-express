const path = require('path')
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const axios = require('axios')

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(cors())
app.use(morgan('tiny'))

app.get('/', (req, res) => res.send('ok'))
app.get('/health', (req, res) => res.send('ok'))

app.post('/gemini', async (req, res) => {
  try {
    const { contents, generationConfig } = req.body || {}
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY missing' })
      return
    }
    const proxyHost = (process.env.PROXY_HOST || 'https://api.niubi.win').replace(/\/+$/, '')
    const model = process.env.MODEL_NAME || 'gemini-2.0-flash'
    const targetUrl = `${proxyHost}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    const googleRes = await axios.post(
      targetUrl,
      { contents, generationConfig: { ...(generationConfig || {}) } },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    )
    res.json(googleRes.data)
  } catch (error) {
    const status = error.response?.status || 500
    res.status(status).json({ error: 'Proxy request failed', details: error.response?.data || error.message })
  }
})

const port = parseInt(process.env.PORT || '80', 10)
app.listen(port)
