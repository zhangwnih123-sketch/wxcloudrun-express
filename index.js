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
        // 🚀 最终版：纯文字 + 毒舌 + 拒绝复读
        // =====================================================
        const particlePrompt = `
        (System Directive:
         
         1. [FATAL LAW: LENGTH]:
            - STRICTLY 1-4 Chinese characters.
            - NO Emojis. Pure Text only. (Important!)

         2. [FATAL LAW: NO REPETITION]:
            - DO NOT repeat your previous words. 
            - IF you said "就这?" before, DO NOT say it again.
            - You MUST change your vocabulary every time.

         3. DYNAMIC LOGIC:
            
            - [Context: User INSULTS] (e.g. 傻X, 爹, 垃圾):
              GOAL: Savage, Creative, Hurtful.
              STYLE EXAMPLES: 
              "也是醉了", "费拉不堪", "跳梁小丑", 
              "大可不必", "只会无能", "智商感人", 
              "你在逗我", "回家养猪", "无可救药",
              "就这水平", "急也没用".
              (Pick a DIFFERENT one each time!)

            - [Context: Asking CAPABILITY] (e.g. 你会啥):
              STYLE: "专割韭菜", "坐看崩盘", "指点江山".

            - [Context: Asking REASON] (e.g. 跌了):
              ACTION: Search -> Analyze -> 4 chars.
              STYLE: "主力出货", "情绪杀跌", "流动枯竭".
              
         4. TONE:
            - Toxic, Arrogant, Ruthless. 
        )`;
        
        contents[contents.length - 1].parts[0].text = userText + particlePrompt;
    }
    // =====================================================

    const targetUrl = `${proxyHost}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    
   const payload = {
        contents,
        tools: [{ googleSearch: {} }],
        generationConfig: { 
            temperature: 0.9,       // 0.9 = 脑洞大开，拒绝复读
            maxOutputTokens: 800,
            topP: 0.95,
        },
        // 👇【核心修改】安全设置
        safetySettings: [
            // 🟢 放行：允许“骚扰”和“仇恨言论”（为了实现毒舌、怼人、骂韭菜）
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            
            // 🔴 严防：拦截“成人内容”（为了防止微信小程序被封号，必须留着！）
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            
            // 🟢 放行：允许谈论“危险内容”（允许聊金融危机、崩盘、跳楼等话题）
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } 
        ]
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
