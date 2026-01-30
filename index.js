const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const axios = require('axios')

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(cors())
app.use(morgan('tiny'))

// 重试请求的辅助函数 (保持不变)
async function requestWithRetry(url, data, options = {}) {
  const timeout = options.timeoutMs || 5000
  const retries = options.retries ?? 2
  const backoff = options.backoffMs || 1000
  let attempt = 0
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

// -------------------------------------------------------
// 🤖 核心接口：Gemini 转发 (已增强)
// -------------------------------------------------------
app.post('/gemini', async (req, res) => {
  try {
    const { contents, generationConfig } = req.body || {}
    const apiKey = process.env.GEMINI_API_KEY
    // 注意：这里 proxyHost 只用于转发 Gemini 请求，不用改，通常是 api.niubi.win 或你的 worker
    const proxyHost = (process.env.PROXY_HOST || 'https://api.niubi.win').replace(/\/+$/, '')
    const model = process.env.MODEL_NAME || 'gemini-2.0-flash'

    if (!apiKey) {
      res.status(500).json({ error: 'MISSING_GEMINI_API_KEY' })
      return
    }

    // =====================================================
    // 💰 金融数据增强模块 (Start)
    // =====================================================
    try {
      // 1. 获取用户最后一条消息
      const lastUserMsg = contents?.[contents.length - 1]?.parts?.[0]?.text || ""
      
      // 2. 简单的关键词映射表 (关键词 -> Yahoo/Binance 代码)
      const symbolMap = {
        'BTC': 'BTC-USD', '比特币': 'BTC-USD',
        'ETH': 'ETH-USD', '以太坊': 'ETH-USD',
        'DOGE': 'DOGE-USD', '狗狗币': 'DOGE-USD',
        'SOL': 'SOL-USD',
        '黄金': 'GC=F', '金价': 'GC=F',
        '白银': 'SI=F',
        '原油': 'CL=F',
        '道指': '^DJI', '道琼斯': '^DJI',
        '纳指': '^IXIC', '纳斯达克': '^IXIC',
        '标普': '^GSPC',
        '苹果': 'AAPL', 'APPLE': 'AAPL',
        '英伟达': 'NVDA', 'NVIDIA': 'NVDA',
        '特斯拉': 'TSLA',
        '微软': 'MSFT',
        '谷歌': 'GOOG',
        '茅台': '600519.SS' // A股
      };

      let targetSymbol = null;
      // 遍历关键词，找到匹配的品种
      for (const [key, code] of Object.entries(symbolMap)) {
        if (lastUserMsg.toUpperCase().includes(key)) {
          targetSymbol = code;
          break; // 找到一个就停止，避免冲突
        }
      }

      // 3. 如果命中关键词，去 Cloudflare Worker 抓取数据
      if (targetSymbol) {
        console.log(`侦测到金融意图: ${targetSymbol}, 正在抓取...`);
        // 👇 请确认这里的域名是你刚刚部署成功的 Worker 域名
        const workerUrl = `https://gemini-proxy.zhangwnih99.workers.dev/finance?symbol=${targetSymbol}`;
        
        // 使用 axios 发起 GET 请求
        const financeRes = await axios.get(workerUrl, { timeout: 3000 });
        const fData = financeRes.data;

        if (fData && fData.price) {
          // 4. 构造数据提示词
          const injectText = `
【数据】${fData.name} 现价:${fData.price} 涨幅:${fData.percent}
【绝对指令】看完数据，只许回4个字！多一个字就滚！
不要报数字细节，只报状态或你的毒舌评价。
参考风格：“跌成狗了”、“起飞芜湖”、“五千二了”、“还要跌吗”、“赶紧抄底”。
`;
          `;
          
          // 5. 将数据拼接到用户消息的末尾 (这样 AI 就能看到了)
          // 确保 contents 结构存在
          if (contents && contents.length > 0 && contents[contents.length - 1].parts) {
             contents[contents.length - 1].parts[0].text += `\n${injectText}`;
          }
        }
      }
    } catch (e) {
      // 容错：如果抓取失败，仅仅打印日志，不影响主流程，让 AI 自己去处理
      console.error('金融数据抓取失败 (非致命):', e.message);
    }
    // =====================================================
    // 💰 金融数据增强模块 (End)
    // =====================================================

    // ✂️ 全局“四字斩” (加在所有对话的最后)
    // =====================================================
    
    // 拿到用户发的内容
    const userText = contents[contents.length - 1].parts[0].text;
    
    // 强制追加“四字指令”
    contents[contents.length - 1].parts[0].text = userText + " (回答仅限4个字以内！多字不回！)";

    // =====================================================
    const targetUrl = `${proxyHost}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    
    const payload = { 
      contents, 
      // 保持 Google 搜索工具开启，作为兜底
      tools: [{ googleSearch: {} }],
      generationConfig: { ...(generationConfig || {}) } 
    }
    
    const data = await requestWithRetry(targetUrl, payload, { timeoutMs: 60000, retries: 2, backoffMs: 800 })
    res.json(data)

  } catch (error) {
    const status = error.status || 500
    res.status(status).json({ error: error.message || 'SERVER_ERROR', details: error.details || '' })
  }
})

const port = parseInt(process.env.PORT || '80', 10)
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
})
