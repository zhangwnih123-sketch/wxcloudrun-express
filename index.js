const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');

const logger = morgan('tiny');
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 首页
app.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Gemini 中转接口 ---
app.post('/gemini', async (req, res) => {
  try {
    const { contents, generationConfig } = req.body;
    
    // 从环境变量获取 API Key
    const apiKey = process.env.GEMINI_API_KEY; 
    
    if (!apiKey) {
      console.error('Missing GEMINI_API_KEY');
      return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing' });
    }

    const MODEL_NAME = 'gemini-2.0-flash-exp';
   // 使用终极霸气反代域名
const PROXY_HOST = 'https://api.niubi.win'; // 👈 填你刚绑定的域名
const targetUrl = `${PROXY_HOST}/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    console.log('Forwarding request to Gemini...');
    const googleRes = await axios.post(targetUrl, {
      contents,
      generationConfig
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });

    res.json(googleRes.data);

  } catch (error) {
    console.error('Gemini Proxy Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Proxy request failed',
      details: error.response?.data || error.message
    });
  }
});

// 启动服务
const port = process.env.PORT || 80;
async function bootstrap() {
  // await initDB(); // 这一行删掉或注释掉，不需要数据库
  app.listen(port, () => {
    console.log('启动成功', port);
  });
}

bootstrap();
