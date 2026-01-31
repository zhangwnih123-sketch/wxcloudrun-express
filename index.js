const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const axios = require('axios')

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(cors())
app.use(morgan('tiny'))

// 重试请求的辅助函数
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
// 🤖 核心接口：Gemini 转发 (四字极简版)
// -------------------------------------------------------
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

    // =====================================================
    // 💰 金融数据增强模块 (Start)
    // =====================================================
    try {
      const lastUserMsg = contents?.[contents.length - 1]?.parts?.[0]?.text || ""
      
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
        '茅台': '600519.SS'
      };

      let targetSymbol = null;
      for (const [key, code] of Object.entries(symbolMap)) {
        if (lastUserMsg.toUpperCase().includes(key)) {
          targetSymbol = code;
          break;
        }
      }

      if (targetSymbol) {
        console.log(`侦测到金融意图: ${targetSymbol}, 正在抓取...`);
        // 👇 请确认这里的域名是你刚刚部署成功的 Cloudflare Worker 域名
        const workerUrl = `https://api.niubi.win/finance?symbol=${targetSymbol}`;
        
        const financeRes = await axios.get(workerUrl, { timeout: 3000 });
        const fData = financeRes.data;

        if (fData && fData.price) {
          // 4. 构造数据提示词 (四字真言版)
          const injectText = `
【数据】${fData.name} 现价:${fData.price} 涨幅:${fData.percent}
【绝对指令】看完数据，只许回4个字！多一个字就滚！
不要报数字细节，只报状态或你的毒舌评价。
参考风格：“跌成狗了”、“起飞芜湖”、“五千二了”、“还要跌吗”、“赶紧抄底”。
`;
          
          // 5. 将数据拼接到用户消息的末尾 (👇 就是这里，之前缺了反引号！)
          if (contents && contents.length > 0 && contents[contents.length - 1].parts) {
             contents[contents.length - 1].parts[0].text += `\n${injectText}`;
          }
        }
      }
    } catch (e) {
      console.error('金融数据抓取失败 (非致命):', e.message);
    }
    // =====================================================
    // 💰 金融数据增强模块 (End)
    // =====================================================


    // =====================================================
    // ✂️ 全局“四字斩” (加在所有对话的最后)
    // =====================================================
    // ✅ 终极版：真实搜索 + 智能压缩
    if (contents && contents.length > 0 && contents[contents.length - 1].parts) {
        const userText = contents[contents.length - 1].parts[0].text;
        
       // =====================================================
        // 🌟 高自由度版：限制字数，但不限制内容
        // =====================================================
        const particlePrompt = `
        (System Directive:
         
         1. [FATAL LAW: LENGTH]:
            - ALL output MUST be strictly 1-4 Chinese characters.
            - If you output >4 chars, system fails.

         2. [FATAL LAW: NO FILLER]:
            - FORBIDDEN: "好的请稍等", "正在查询", "让我想想".
            - Just say the result directly.

         3. DYNAMIC RESPONSE LOGIC:
            
            - [Context: Asking WHY/REASON] (e.g. 黄金为啥跌):
              ACTION: Google Search -> Analyze -> Compress to 4 chars.
              GOAL: Accurate financial insight.
              STYLE EXAMPLES: "加息落地", "情绪宣泄", "主力诱空". (Don't just copy, analyze the REAL reason!)

            - [Context: Asking CAPABILITY] (e.g. 你会啥):
              GOAL: Be arrogant and sarcastic.
              STYLE EXAMPLES: "专割韭菜", "指点江山", "毒舌评股". (Invent new 4-char phrases!)

            - [Context: User INSULTS] (e.g. 滚, 垃圾):
              GOAL: Savage counter-attack.
              STYLE EXAMPLES: "反弹", "无知", "就这?", "不仅蠢". (Be creative with your insults!)

            - [Context: General Chat]:
              GOAL: Professional but cold.
              
         4. CREATIVITY INSTRUCTION:
            - Do NOT repeat the examples above.
            - Use your vast vocabulary to generate NEW, SHARP, 4-char terms based on the user's input.
        )`;
        
        contents[contents.length - 1].parts[0].text = userText + particlePrompt;
    }
    // =====================================================

    const targetUrl = `${proxyHost}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    
   // ✅ 修改位置：强制提高“创造力”到 0.9
      const payload = {
        contents,
        tools: [{ googleSearch: {} }],
        generationConfig: { 
            temperature: 0.9,       // 🔥 核心修改：0.9 代表脑洞大开，拒绝复读机
            maxOutputTokens: 800,   // 保持回复长度足够（虽然我们会压缩，但留足空间）
            topP: 0.95,             // 增加词汇丰富度
        }
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
