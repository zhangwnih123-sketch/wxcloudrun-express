const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios'); // 引入 axios
const { init: initDB, Counter } = require('./db');

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

// 计数器示例接口 (保留)
app.get('/api/count', async (req, res) => {
  const result = await Counter.count();
  res.send({ code: 0, data: result });
});

app.post('/api/count', async (req, res) => {
  const { action } = req.body;
  if (action === 'inc') {
    await Counter.create();
  } else if (action === 'clear') {
    await Counter.destroy({ truncate: true });
  }
  res.send({ code: 0, data: await Counter.count() });
});

// --- Gemini 中转接口 (新增) ---
app.post('/gemini', async (req, res) => {
  try {
    // 1. 获取前端传来的参数
    // 小程序端会传: { contents: [...], generationConfig: {...} }
    const { contents, generationConfig } = req.body;
    
    // 2. 从环境变量获取 API Key (安全！)
    // 你需要在微信云托管控制台 -> 设置 -> 环境变量 中添加 GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY; 
    
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing' });
    }

    // 3. 构造 Google Gemini API 地址
    // 注意：云托管容器如果不能直接连 google，这里需要换成这一步的目标地址
    // 如果你没有海外跳板，可以尝试直接请求 google (有些云托管区域可能通)，或者使用 Cloudflare Worker 地址
    const MODEL_NAME = 'gemini-2.0-flash-exp'; // 或者 gemini-1.5-flash
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    // 4. 发送请求给 Google
    console.log('Forwarding request to Gemini...');
    const googleRes = await axios.post(targetUrl, {
      contents,
      generationConfig
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000 // 60秒超时
    });

    // 5. 返回结果给小程序
    res.json(googleRes.data);

  } catch (error) {
    console.error('Gemini Proxy Error:', error.response?.data || error.message);
    
    // 返回错误信息
    res.status(error.response?.status || 500).json({
      error: 'Proxy request failed',
      details: error.response?.data || error.message
    });
  }
});

// 启动服务
const port = process.env.PORT || 80;
async function bootstrap() {
  await initDB();
  app.listen(port, () => {
    console.log('启动成功', port);
  });
}

bootstrap();
