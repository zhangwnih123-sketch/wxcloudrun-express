// index.js


// 物理参数配置
const PHYSICS = {
  friction: 0.96,       // 摩擦系数
  maxEase: 0.005,       // 最大归位力 (0.01 -> 0.005) 极其微弱的引力，几乎是“若有若无”
  gravityFactor: 3.0,   // 重力影响系数
  explosionFactor: 5.0, // 爆炸扩散系数
  spacing: 4,           // 采样步长
  particleColor: '#FFFFFF', // 纯白实体颜色，无透明度
  trailAlpha: 1.0,      // (未使用，但标记为不透明)
};

class Particle {
  constructor(x, y, dpr) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.targetX = x;
    this.targetY = y;
    this.baseX = x;
    this.baseY = y;
    this.size = 1.6; // 默认大小
    this.color = PHYSICS.particleColor;
    this.dpr = dpr;
  }

  /**
   * 更新粒子状态
   * @param {number} gX - 重力 X
   * @param {number} gY - 重力 Y
   * @param {number} restoreStrength - 当前归位力度 (1.0=聚合, 0.0=离散)
   * @param {number} shakeImpulse - 瞬间甩动力度
   * @param {number} canvasWidth 
   * @param {number} canvasHeight 
   */
  update(gX, gY, restoreStrength, shakeImpulse, canvasWidth, canvasHeight) {
    // 1. 计算重力影响 (平放时减弱)
    const gravityWeight = Math.max(0, 1 - restoreStrength * 1.5); 
    
    // --- 法向力模拟 & 噪点抑制 ---
    const margin = this.size;
    let effectiveGX = gX;
    let effectiveGY = gY;
    let suppressNoiseX = false;
    let suppressNoiseY = false;
    
    // 增加检测范围 (margin + 2)，确保在接触前就进入稳定态
    const stableDist = margin + 2.0;

    // 左墙
    if (this.x <= stableDist && gX < 0) {
      effectiveGX = 0;
      suppressNoiseX = true;
    }
    // 右墙
    if (this.x >= canvasWidth - stableDist && gX > 0) {
      effectiveGX = 0;
      suppressNoiseX = true;
    }
    // 上墙
    if (this.y <= stableDist && gY < 0) {
      effectiveGY = 0;
      suppressNoiseY = true;
    }
    // 下墙
    if (this.y >= canvasHeight - stableDist && gY > 0) {
      effectiveGY = 0;
      suppressNoiseY = true;
    }
 
    // 基础流体运动 (使用修正后的重力)
    this.vx += effectiveGX * PHYSICS.gravityFactor * gravityWeight;
    this.vy += effectiveGY * PHYSICS.gravityFactor * gravityWeight;
 
    // 2. 甩动爆炸效果 (无方向散射)
    // 根据甩动力度施加随机方向的冲量
    if (shakeImpulse > 0.1) {
      this.vx += (Math.random() - 0.5) * shakeImpulse * PHYSICS.explosionFactor;
      this.vy += (Math.random() - 0.5) * shakeImpulse * PHYSICS.explosionFactor;
    }
    
    // 3. 自然扰动 (在边界处禁用，防止抖动)
    if (!suppressNoiseX) this.vx += (Math.random() - 0.5) * 0.2 * gravityWeight;
    if (!suppressNoiseY) this.vy += (Math.random() - 0.5) * 0.2 * gravityWeight;

    // 4. 根据倾斜程度施加归位力 (弹簧力)
    // restoreStrength: 1.0 (平放) -> 0.0 (倾斜)
    if (restoreStrength > 0.01) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      
      // 归位力随 restoreStrength 变化
      const ease = PHYSICS.maxEase * restoreStrength;
      this.vx += dx * ease;
      this.vy += dy * ease;
    }

    // 5. 边界反弹 (防止流出屏幕)
    // 只有在归位力很弱（流体态）时才强制边界检查，避免聚合时被墙挡住
    if (restoreStrength < 0.5) {
      const margin = this.size;
      const bounceThreshold = 5.0; // 只有速度大于 5 才反弹，否则直接吸附

      // X轴边界
      if (this.x < margin) { 
        this.x = margin; 
        if (this.vx < 0) {
          // 高速撞击 -> 反弹
          if (Math.abs(this.vx) > bounceThreshold) {
             this.vx *= -0.6; 
          } else {
             // 低速接触 -> 吸附 (彻底消除抖动)
             this.vx = 0;
          }
        }
      } else if (this.x > canvasWidth - margin) { 
        this.x = canvasWidth - margin; 
        if (this.vx > 0) {
          if (Math.abs(this.vx) > bounceThreshold) {
             this.vx *= -0.6;
          } else {
             this.vx = 0;
          }
        }
      }
      
      // Y轴边界
      if (this.y < margin) { 
        this.y = margin; 
        if (this.vy < 0) {
          if (Math.abs(this.vy) > bounceThreshold) {
             this.vy *= -0.6;
          } else {
             this.vy = 0;
          }
        }
      } else if (this.y > canvasHeight - margin) { 
        this.y = canvasHeight - margin; 
        if (this.vy > 0) {
          if (Math.abs(this.vy) > bounceThreshold) {
             this.vy *= -0.6;
          } else {
             this.vy = 0;
          }
        }
      }
    }

    // 6. 应用摩擦力
    this.vx *= PHYSICS.friction;
    this.vy *= PHYSICS.friction;

    // 7. 更新位置
    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

Page({
  data: {
    width: 0,
    height: 0,
    pixelRatio: 1,
    // 录音相关状态
    isRecording: false,
    recordDuration: 0,
    recognitionResult: '',
    deepSeekResponse: '',
    // 粒子状态：idle（空闲）、listening（监听中）、thinking（思考中）、showingResult（展示结果）
    particleState: 'idle',
  },

  // 实例变量
  canvas: null,
  ctx: null,
  particles: [],
  animationId: null,
  offscreenCanvas: null,
  offscreenCtx: null,
  // 录音相关实例变量
  recorderManager: null,
  recordTimer: null,
  
  // 百度语音识别配置
  baiduConfig: config.baidu,
  
  // 状态变量
  lastTimeStr: '',
  // 缓存上一次的 AI 回复，避免重复采样
  lastDeepSeekResponse: '',
  gravityX: 0,
  gravityY: 0,
  restoreStrength: 1, // 归位力度 (1=完全聚合, 0=完全离散)
  shakeImpulse: 0,    // 瞬间甩动冲量
  lastAccel: { x: 0, y: 0, z: 0 },
  // 圆环旋转角度
  ringRotation: 0,
  breathPhase: 0,
  resultDisplayUntil: 0,
  resultTimer: null,
  resultSeq: 0,
  lastRenderedResultSeq: -1,
  // 上一次的粒子状态
  lastParticleState: '',
  resultRevealStart: 0,
  resultRevealDuration: 1200,

  onShow() {
    // 确保每次显示页面时启动加速度计
    wx.startAccelerometer({
      interval: 'ui', // 改用 ui 频率 (60ms)
      fail: (err) => console.error("加速度计启动失败", err)
    });
  },

  onLoad() {
    // 初始化录音管理器
    this.initRecorderManager();
    this.ensureRecordPermissionOnFirstEntry();
    
    wx.onAccelerometerChange((res) => {
      // 1. 计算倾斜度 (Tilt Magnitude)
      const tilt = Math.max(Math.abs(res.x), Math.abs(res.y));

      // 2. 计算瞬间甩动幅度 (Jerk/Shake Magnitude)
      // 通过比较当前帧和上一帧的加速度差值
      const deltaX = Math.abs(res.x - this.lastAccel.x);
      const deltaY = Math.abs(res.y - this.lastAccel.y);
      // 简单平滑一下
      const newImpulse = (deltaX + deltaY) * 2.0;
      // 取较大的冲量，确保甩动能被捕捉到
      if (newImpulse > this.shakeImpulse) {
        this.shakeImpulse = newImpulse;
      }
      
      // 3. 更新重力向量 (用于驱动流体)
      this.gravityX = res.x * 2.0;
      this.gravityY = -res.y * 2.0;

      // 4. 动态计算归位力度 (Restore Strength)
      // 这里的阈值决定了“多平”算平放
      const minTilt = 0.3; // 小于 0.3 就算完全平放
      const maxTilt = 0.6; // 大于 0.6 才完全散开

      let strength = 0;
      if (tilt < minTilt) {
        strength = 1;
      } else if (tilt > maxTilt) {
        strength = 0;
      } else {
        strength = (maxTilt - tilt) / (maxTilt - minTilt);
      }
      this.restoreStrength = strength;

      this.lastAccel = res;
    });
  },

  // 初始化录音管理器
  initRecorderManager() {
    this.recorderManager = wx.getRecorderManager();
    
    // 监听录音开始
    this.recorderManager.onStart(() => {
      console.log('录音开始');
      this.setData({ isRecording: true });
      // 开始计时
      this.startRecordTimer();
    });
    
    // 监听录音停止
    this.recorderManager.onStop((res) => {
      console.log('录音停止', res);
      console.log('录音文件路径：', res.tempFilePath);
      console.log('录音时长：', res.duration + 'ms');
      this.setData({ isRecording: false });
      this.stopRecordTimer();
      // 上传录音到百度语音识别
      this.uploadToBaidu(res.tempFilePath);
    });
    
    // 监听录音错误
    this.recorderManager.onError((err) => {
      console.error('录音错误', err);
      console.error('错误详情：', JSON.stringify(err));
      this.setData({ isRecording: false });
      this.stopRecordTimer();
      // 录音错误回到空闲状态
      this.setData({ particleState: 'idle' });
    });
  },

  ensureRecordPermissionOnFirstEntry() {
    let prompted = false;
    try {
      prompted = !!wx.getStorageSync('recordPermissionPrompted');
    } catch (e) {}

    if (prompted) return;

    try {
      wx.setStorageSync('recordPermissionPrompted', true);
    } catch (e) {}

    wx.getSetting({
      success: (res) => {
        if (res.authSetting && res.authSetting['scope.record']) return;
        wx.authorize({
          scope: 'scope.record',
          fail: () => {
            wx.showModal({
              title: '需要录音权限',
              content: '用于语音输入。你可以在设置中开启录音权限。',
              confirmText: '去设置',
              cancelText: '暂不',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.openSetting();
                }
              }
            });
          }
        });
      }
    });
  },
  
  ensureLocationPermissionOnFirstEntry() {
    let prompted = false;
    try {
      prompted = !!wx.getStorageSync('locationPermissionPrompted');
    } catch (e) {}
    if (prompted) {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting && res.authSetting['scope.userLocation']) {
            this.fetchAndStoreLocation();
          }
        }
      });
      return;
    }
    try {
      wx.setStorageSync('locationPermissionPrompted', true);
    } catch (e) {}
    wx.getSetting({
      success: (res) => {
        if (res.authSetting && res.authSetting['scope.userLocation']) {
          this.fetchAndStoreLocation();
          return;
        }
        wx.showModal({
          title: '需要地理位置权限',
          content: '用于个性化上下文，让回答更贴近你的所在地区。',
          confirmText: '去授权',
          cancelText: '稍后',
          success: (m) => {
            if (m.confirm) {
              wx.authorize({
                scope: 'scope.userLocation',
                success: () => this.fetchAndStoreLocation(),
                fail: () => {
                  wx.showModal({
                    title: '未授权位置',
                    content: '你可以在“设置”中开启位置权限以提升体验。',
                    showCancel: false
                  });
                }
              });
            }
          }
        });
      }
    });
  },
  
  fetchAndStoreLocation() {
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        try {
          wx.setStorageSync('userLocation', {
            latitude: res.latitude,
            longitude: res.longitude,
            accuracy: res.accuracy
          });
        } catch (e) {}
      }
    });
  },

  // 开始录音
  startRecording() {
    // 增加震动反馈（防止吞字）
    wx.vibrateShort();

    // 检查录音权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success: () => {
              // 用户同意授权，开始录音
              this._startRecorderInternal();
            },
            fail: () => {
              // 用户拒绝授权，引导用户开启
              wx.showModal({
                title: '需要录音权限',
                content: '请在设置中开启录音权限以进行语音对话',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting();
                  }
                }
              });
            }
          });
        } else {
          // 已有权限，直接开始
          this._startRecorderInternal();
        }
      },
      fail: () => {
        // 获取设置失败，尝试直接开始（通常不会发生）
        this._startRecorderInternal();
      }
    });
  },

  // 内部录音启动函数
  _startRecorderInternal() {
    // 强行指定录音参数，确保16000Hz PCM配置生效
    const recordOptions = {
      duration: 60000, // 最长60秒
      sampleRate: 16000, // 强制16000Hz采样率
      numberOfChannels: 1, // 单声道
      encodeBitRate: 48000, // 48kbps编码率
      format: 'pcm', // 强制PCM格式
      frameSize: 50 // 帧大小
    };
    
    console.log('开始录音，使用参数：', recordOptions);
    this.recorderManager.start(recordOptions);
    // 设置粒子状态为监听中
    this.setData({ particleState: 'listening' });
  },

  // 停止录音
  stopRecording() {
    console.log('停止录音');
    this.recorderManager.stop();
    // 设置粒子状态为思考中
    this.setData({ particleState: 'thinking' });
  },

  // 开始计时
  startRecordTimer() {
    this.setData({ recordDuration: 0 });
    this.recordTimer = setInterval(() => {
      this.setData({
        recordDuration: this.data.recordDuration + 1
      });
    }, 1000);
  },

  // 停止计时
  stopRecordTimer() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
  },

  onReady() {
    this.initCanvas();
  },

  onUnload() {
    wx.stopAccelerometer();
    if (this.animationId) {
      this.canvas.cancelAnimationFrame(this.animationId);
    }
  },

  // 触摸开始事件
  onTouchStart(e) {
    this.touchStartTime = e.timeStamp;
    this.touchStartX = e.touches[0].pageX;
    this.touchStartY = e.touches[0].pageY;
    
    // 设置长按定时器（500ms算长按）
    this.longPressTimer = setTimeout(() => {
      this.isLongPress = true;
      this.startRecording();
    }, 500);
  },

  // 触摸移动事件
  onTouchMove(e) {
    // 如果手指移动距离超过一定阈值，取消长按判定
    const moveX = e.touches[0].pageX;
    const moveY = e.touches[0].pageY;
    if (Math.abs(moveX - this.touchStartX) > 10 || Math.abs(moveY - this.touchStartY) > 10) {
      clearTimeout(this.longPressTimer);
    }
  },

  // 触摸结束事件
  onTouchEnd(e) {
    clearTimeout(this.longPressTimer);
    
    if (this.isLongPress) {
      // 如果是长按，结束录音
      this.stopRecording();
      this.isLongPress = false;
    } else {
      // 如果是短按，检测双击
      // 检查移动距离，防止滑动误触
      const endX = e.changedTouches[0].pageX;
      const endY = e.changedTouches[0].pageY;
      if (Math.abs(endX - this.touchStartX) < 10 && Math.abs(endY - this.touchStartY) < 10) {
        const currentTime = e.timeStamp;
        const gap = currentTime - (this.lastTapTime || 0);
        
        // 双击间隔在 300ms 以内
        if (gap > 0 && gap < 300) {
          this.showInputBox();
          this.lastTapTime = 0; // 重置，防止三击触发两次
        } else {
          this.lastTapTime = currentTime;
        }
      }
    }
  },

  // 显示输入框
  showInputBox() {
    this.setData({ showInput: true });
  },

  // 隐藏输入框
  hideInput() {
    this.setData({ showInput: false });
  },

  // 阻止冒泡
  stopProp() {},

  // 输入框确认
  onInputConfirm(e) {
    const text = e.detail.value;
    if (!text || text.trim() === '') return;
    
    this.hideInput();
    this.requestGemini(text);
  },
  
  loadChatHistory() {
    let h = [];
    try {
      h = wx.getStorageSync('chatHistory') || [];
    } catch (e) {}
    if (!Array.isArray(h)) return [];
    return h;
  },
  
  saveChatHistory(arr) {
    try {
      wx.setStorageSync('chatHistory', arr);
    } catch (e) {}
  },
  
  appendChatRecord(role, text) {
    const h = this.loadChatHistory();
    h.push({ role, text, ts: Date.now() });
    while (h.length > 100) h.shift();
    this.saveChatHistory(h);
  },
  

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#liquidClock')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const info = wx.getWindowInfo();
        const dpr = info.pixelRatio || 1;
        const logicalWidth = res[0].width;
        const logicalHeight = res[0].height;
        const physicalWidth = Math.max(1, Math.round(logicalWidth * dpr));
        const physicalHeight = Math.max(1, Math.round(logicalHeight * dpr));

        // 设置画布物理尺寸
        canvas.width = physicalWidth;
        canvas.height = physicalHeight;
        if (typeof ctx.setTransform === 'function') {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        } else if (typeof ctx.resetTransform === 'function') {
          ctx.resetTransform();
        }
        ctx.scale(dpr, dpr);

        // 移除 shadowBlur 以提升性能，改用 globalCompositeOperation = 'lighter' 实现发光
        // ctx.shadowBlur = 10;
        // ctx.shadowColor = PHYSICS.particleColor;

        this.canvas = canvas;
        this.ctx = ctx;
        this.data.width = logicalWidth;
        this.data.height = logicalHeight;
        this.data.pixelRatio = dpr;

        // 初始填充黑色背景，防止闪白
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.data.width, this.data.height);

        // 创建离屏 Canvas 用于文字采样
        this.offscreenCanvas = wx.createOffscreenCanvas({ type: '2d', width: physicalWidth, height: physicalHeight });
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        
        // 初始时间采样
        this.updateParticlesTargets();
        
        // 开始渲染循环
        this.renderLoop();
      });
  },

  generateRingTargets(particleState) {
    const logicalWidth = this.data.width;
    const logicalHeight = this.data.height;
    const centerX = logicalWidth / 2;
    const centerY = logicalHeight / 2;
    const minDim = Math.min(logicalWidth, logicalHeight);

    const baseRadius = minDim * 0.12;
    const ringGap = minDim * 0.022;
    const ringCount = 2;
    const spacing = particleState === 'listening' ? 7 : 7;

    const targets = [];
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
      const radius = baseRadius + ringIndex * ringGap;
      const circumference = 2 * Math.PI * radius;
      const points = Math.max(36, Math.round(circumference / spacing));
      const ringRotation = particleState === 'thinking'
        ? this.ringRotation * (1 + ringIndex * 0.15)
        : 0;
      for (let i = 0; i < points; i++) {
        const theta = (i / points) * Math.PI * 2 + ringRotation;
        targets.push({
          x: centerX + radius * Math.cos(theta),
          y: centerY + radius * Math.sin(theta)
        });
      }
    }
    return targets;
  },

  applyParticleTargets(newTargets, particleState) {
    const numTargets = newTargets.length;
    const numParticles = this.particles.length;

    if (numParticles < numTargets) {
      for (let i = numParticles; i < numTargets; i++) {
        const startX = Math.random() * this.data.width;
        const startY = Math.random() * this.data.height;
        this.particles.push(new Particle(startX, startY, this.data.pixelRatio));
      }
    } else if (numParticles > numTargets) {
      this.particles.splice(numTargets);
    }

    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].targetX = newTargets[i].x;
      this.particles[i].targetY = newTargets[i].y;
      switch (particleState) {
        case 'listening':
          this.particles[i].color = '#FFFFFF';
          this.particles[i].size = 1.8;
          break;
        case 'thinking':
          this.particles[i].color = '#FFFFFF';
          this.particles[i].size = 1.8;
          break;
        case 'showingResult':
          this.particles[i].color = '#FFFFFF';
          this.particles[i].size = 2.0;
          break;
        default:
          this.particles[i].color = PHYSICS.particleColor;
          this.particles[i].size = 1.6;
      }
    }
  },

  /**
   * 生成当前时间并转换为粒子目标点
   */
  updateParticlesTargets() {
    const { particleState, deepSeekResponse } = this.data;
    const effectiveState = Date.now() < this.resultDisplayUntil ? 'showingResult' : particleState;

    if (effectiveState === 'listening' || effectiveState === 'thinking') {
      this.lastParticleState = effectiveState;
      const targets = this.generateRingTargets(effectiveState);
      this.applyParticleTargets(targets, effectiveState);
      return;
    }
    const width = this.canvas.width; // 物理像素宽
    const height = this.canvas.height; // 物理像素高
    const ctx = this.offscreenCtx;
    const centerX = width / 2;
    const centerY = height / 2;
    const newTargets = [];
    
    // 记录当前状态
    this.lastParticleState = effectiveState;
    
    ctx.clearRect(0, 0, width, height);
    
    switch (effectiveState) {
      case 'showingResult':
        if (this.lastRenderedResultSeq === this.resultSeq) return;
        this.lastRenderedResultSeq = this.resultSeq;
        this.lastDeepSeekResponse = deepSeekResponse;

        // 绘制 DeepSeek 结果文字 - 增大字号
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.floor(width * 0.4)}px sans-serif`; // 增大到屏幕宽度的40%
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(deepSeekResponse || '思考中...', width / 2, height / 2);
        break;
        
      default: // idle
        // 绘制时间文字
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        
        // 如果时间没变，不需要重新采样
        if (timeStr === this.lastTimeStr && effectiveState === 'idle') return;
        this.lastTimeStr = timeStr;
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.floor(width / 4)}px sans-serif`; // 动态字号
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeStr, width / 2, height / 2);
    }
    
    // --- 2. 读取像素数据 ---
    const imageData = ctx.getImageData(0, 0, width, height).data;
    
    // 优化采样密度，根据状态调整步长
    let step;
    if (effectiveState === 'showingResult') {
      // 大字号时，使用较小的步长，增加粒子数量
      step = 3 * this.data.pixelRatio; // 每隔3个像素取一个粒子
    } else {
      step = PHYSICS.spacing * this.data.pixelRatio; // 其他状态使用原步长
    }
    const stepPx = Math.max(1, Math.round(step));
    
    // 遍历像素，找到非黑色像素点
        for (let y = 0; y < height; y += stepPx) {
          for (let x = 0; x < width; x += stepPx) {
            const index = (y * width + x) * 4;
            const r = imageData[index];
            const g = imageData[index + 1];
            const b = imageData[index + 2];
            const a = imageData[index + 3];
            
            // 判定条件：alpha 通道大于 128 且 RGB 颜色为白色（亮度大于 200）
            if (a > 128 && r > 200 && g > 200 && b > 200) {
              newTargets.push({ 
                x: x / this.data.pixelRatio, 
                y: y / this.data.pixelRatio 
              });
            }
          }
        }
    
    // --- 3. 粒子池管理 (Particle Pooling) ---
    this.applyParticleTargets(newTargets, effectiveState);
  },

  renderLoop() {
    if (!this.ctx) return;
    
    const { particleState } = this.data;

    if (particleState === 'thinking') {
      this.ringRotation += 0.08;
    }
    
    // 更新粒子目标
    this.updateParticlesTargets();
    
    // --- 1. 拖尾效果 ---
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = '#000000'; // 必须是纯黑
    this.ctx.fillRect(0, 0, this.data.width, this.data.height);
    
    // --- 2. 绘制粒子 ---
    this.ctx.globalCompositeOperation = 'lighter';
    if (particleState === 'showingResult') {
      const now = Date.now();
      const t = Math.min(1, Math.max(0, (now - this.resultRevealStart) / this.resultRevealDuration));
      const eased = t * t * (3 - 2 * t);
      this.ctx.globalAlpha = eased;
    } else {
      this.ctx.globalAlpha = 1;
    }
    
    this.particles.forEach(p => {
      // 关键修正：传递正确的参数，包括 restoreStrength 和 shakeImpulse
      const restoreStrength = (particleState === 'listening' || particleState === 'thinking' || particleState === 'showingResult') ? 1 : this.restoreStrength;
      p.update(this.gravityX, this.gravityY, restoreStrength, this.shakeImpulse, this.data.width, this.data.height);
      p.draw(this.ctx);
    });
    this.ctx.globalAlpha = 1;
    
    // 甩动冲量每帧衰减，模拟能量耗散
    this.shakeImpulse *= 0.9;
    
    // 循环
    this.animationId = this.canvas.requestAnimationFrame(() => this.renderLoop());
  },

  // 获取百度语音识别Token
  getBaiduToken() {
    return new Promise((resolve, reject) => {
      // 如果已有Token，直接返回
      if (this.baiduConfig.token) {
        console.log('使用缓存的百度Token');
        resolve(this.baiduConfig.token);
        return;
      }
      
      const { apiKey, secretKey } = this.baiduConfig;
      if (!apiKey || !secretKey) {
        const errorMsg = '百度API Key和Secret Key未填写';
        console.error(errorMsg);
        reject(new Error(errorMsg));
        return;
      }
      
      // 发送请求获取Token
      wx.request({
        url: 'https://aip.baidubce.com/oauth/2.0/token',
        method: 'GET',
        data: {
          grant_type: 'client_credentials',
          client_id: apiKey,
          client_secret: secretKey
        },
        success: (res) => {
          // 打印完整响应，便于调试
          console.log('百度完整响应:', res);
          
          // 检查响应结构
          if (res.data && res.data.access_token) {
            // 拿到Token后，更新到this.baiduConfig.token中
            this.baiduConfig.token = res.data.access_token;
            console.log('百度Token获取成功:', this.baiduConfig.token);
            resolve(this.baiduConfig.token);
          } else {
            // 处理Token获取失败的情况
            const errorMsg = res.data && res.data.error_description ? res.data.error_description : '未知错误';
            console.error('百度Token获取失败:', errorMsg);
            console.error('响应数据:', res.data);
            reject(new Error('获取Token失败：' + errorMsg));
          }
        },
        fail: (err) => {
          // 处理请求失败的情况
          console.error('百度Token请求失败:', err);
          console.error('错误详情:', err.errMsg);
          reject(new Error('获取Token请求失败：' + err.errMsg));
        },
        complete: () => {
          console.log('百度Token请求结束');
        }
      });
    });
  },

  // 上传录音到百度语音识别
  uploadToBaidu(tempFilePath) {
    try {
      console.log('开始上传录音到百度语音识别');
      
      // 获取Token
      this.getBaiduToken().then(token => {
        console.log('百度Token获取成功');
        
        // 读取文件内容
        return this.readFile(tempFilePath).then(fileContent => {
          console.log('录音文件读取成功，大小：', fileContent.byteLength);
          
          // 转换为Base64
          const base64 = wx.arrayBufferToBase64(fileContent);
          console.log('录音文件转换为Base64成功');
          
          // 发送请求到百度语音识别API
          wx.request({
            url: 'https://vop.baidu.com/server_api',
            method: 'POST',
            header: {
              'Content-Type': 'application/json'
            },
            data: {
              format: 'pcm', // 严格对应百度PCM 16k要求，必须小写
              rate: 16000,
              channel: 1,
              cuid: wx.getStorageSync('cuid') || '123456PYTHON', // 必填
              dev_pid: 1536, // 改为普通话搜索模型，权限最稳，适合短句
              token: token,
              speech: base64,
              len: fileContent.byteLength // 数字类型
            },
            success: (res) => {
              console.log('百度语音识别响应：', res.data);
              console.log('响应状态码：', res.statusCode);
              console.log('响应数据结构：', JSON.stringify(res.data));
              
              // 检查百度识别结果是否为空
              if (res.data.result && res.data.result.length > 0) {
                const recognitionResult = res.data.result[0];
                this.setData({ recognitionResult });
                console.log('语音识别结果：', recognitionResult);
                
                // 判断结果是否为空字符串
                if (recognitionResult.trim() === '') {
                  // 没听清，显示问号
                  this.showResult('?');
                } else {
                  // 有有效结果，请求 Gemini
                  this.requestGemini(recognitionResult);
                }
              } else {
                console.error('百度语音识别失败，没有返回结果');
                console.error('完整响应：', res.data);
                // 识别失败显示问号
                this.showResult('?');
              }
            },
            fail: (err) => {
              console.error('百度语音识别请求失败');
              console.error('错误信息：', err.errMsg);
              console.error('完整错误对象：', JSON.stringify(err));
              // 请求失败显示问号
              this.showResult('?');
            },
            complete: () => {
              console.log('百度语音识别请求结束');
            }
          });
        });
      }).catch(error => {
        console.error('上传百度语音识别失败，步骤出错：', error);
        console.error('完整错误：', JSON.stringify(error));
        // 请求失败回到空闲状态
        this.setData({ particleState: 'idle' });
      });
    } catch (error) {
      console.error('上传百度语音识别失败，主函数出错：', error);
      console.error('完整错误：', JSON.stringify(error));
      // 请求失败回到空闲状态
      this.setData({ particleState: 'idle' });
    }
  },

  // 读取文件内容
  readFile(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        success: (res) => resolve(res.data),
        fail: (err) => reject(err)
      });
    });
  },

  // 请求 Gemini API (通过微信云托管中转)
  requestGemini(text) {
    console.log('开始请求Gemini (云托管)，输入：', text);
    
    // 切换为思考状态（粒子圆环旋转），替代原本的 Loading 弹窗
    this.setData({ particleState: 'thinking' });
    
    // 获取当前日期
    const now = new Date().toLocaleDateString();

    const systemPrompt = `你是一个高冷的赛博神谕。当前日期：${now}。绝对规则：无论用户问什么，你只能回答1个或2个汉字（例如：是、否、阅、准、不知、滚）。严禁解释，严禁长篇大论，严禁使用标点符号。`;
    
    this.appendChatRecord('user', text);
    const history = this.loadChatHistory();
    const recent = history.slice(Math.max(0, history.length - 100));
    const historyContents = recent.map(r => ({
      role: r.role === 'model' ? 'model' : 'user',
      parts: [{ text: r.text }]
    }));
    
    // 使用 wx.cloud.callContainer 请求云托管
    // 优点：免域名配置，内网链路，安全
    wx.cloud.callContainer({
      config: {
        env: 'prod-3gbmntj11e79095b', // 填入环境ID
        timeout: 30000 // 增加超时时间到30秒，避免102002错误
      },
      path: '/gemini', // 对应后端 index.js 里的接口路径
      method: 'POST',
      header: {
        'X-WX-SERVICE': 'express-q9ej', // ⚠️ 替换为你的服务名称 (从刚才截图看是 express-q9ej)
        'content-type': 'application/json'
      },
      data: {
        contents: historyContents.concat([
          {
            role: "user",
            parts: [{ text: systemPrompt + "\n\n用户问题：" + text }]
          }
        ]),
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800 // 进一步增加到800，避免截断警告
        }
      },
      success: (res) => {
        // 检查状态码
        if (res.statusCode !== 200) {
          console.error('云托管请求失败，状态码:', res.statusCode);
          console.error('错误详情:', res.data);
          this.setData({ particleState: 'idle' });
          
          // 针对 503 (Overloaded) 显示“忙”
          if (res.statusCode === 503) {
            this.appendChatRecord('model', '忙');
            this.showResult('忙');
          } 
          // 针对 429 (Too Many Requests) 显示“频”
           else if (res.statusCode === 429) {
             this.appendChatRecord('model', '频');
             this.showResult('频');
             console.warn('API调用频率过高 (429)');
           } 
           // 针对 401 (Unauthorized) 显示“权” (Key无效)
           else if (res.statusCode === 401) {
             this.appendChatRecord('model', '权');
             this.showResult('权');
             console.error('API Key 无效或缺失 (401)');
           } else {
             this.appendChatRecord('model', '?');
             this.showResult('?');
           }
          return;
        }
        
        const responseData = res.data; // 后端返回的完整数据

        // 检查是否有错误信息
        if (responseData.error) {
           console.error('Gemini API 返回错误:', responseData.error);
           // 针对 503 错误体
           if (responseData.error.code === 503 || (responseData.error.message && responseData.error.message.includes('overloaded'))) {
             this.showResult('忙');
           } 
           // 针对 429 错误体
           else if (responseData.error.code === 429 || (responseData.error.status === 'RESOURCE_EXHAUSTED')) {
             this.showResult('频');
           } 
           // 针对 401 错误体
           else if (responseData.error.code === 401 || (responseData.error.status === 'UNAUTHENTICATED')) {
             this.showResult('权');
           } else {
             this.showResult('!');
           }
           return;
        }

        // 解析 Gemini 响应结构
        if (responseData && responseData.candidates && responseData.candidates.length > 0) {
          const candidate = responseData.candidates[0];
          
          // 检查安全拦截
          if (candidate.finishReason === 'SAFETY') {
             console.warn('Gemini 拒绝回答（安全原因）');
             this.appendChatRecord('model', '嘘');
             this.showResult('嘘');
             return;
          }

          // 检查 MAX_TOKENS (如果内容被截断，可能导致 parts 为空或不完整)
          if (candidate.finishReason === 'MAX_TOKENS') {
             console.warn('Gemini 回答过长被截断', candidate);
          }

          if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            let content = candidate.content.parts[0].text;
            console.log('Gemini 原始回复:', content); // 打印原始回复以调试

            // 字符清洗逻辑：去掉所有标点符号，只保留汉字、字母和数字
            const cleanContent = content.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
            console.log('先知断言（清洗后）：', cleanContent);
            
            // 如果清洗后为空（例如全是标点），显示“无”
            if (!cleanContent) {
               // 如果原始内容不为空但清洗后为空，可能是全是标点，尝试截取前两个字符
               if (content && content.trim().length > 0) {
                 const r = content.substring(0, 2);
                 this.appendChatRecord('model', r);
                 this.showResult(r);
               } else {
                 this.appendChatRecord('model', '无');
                 this.showResult('无');
               }
            } else {
               // 截取前4个字符，防止过长
               const r = cleanContent.substring(0, 4);
               this.appendChatRecord('model', r);
               this.showResult(r);
            }
          } else {
            console.error('Gemini 响应格式错误，缺少parts', candidate);
            // 如果是因为截断导致没内容，显示“长”，否则显示“？”
            if (candidate.finishReason === 'MAX_TOKENS') {
              this.appendChatRecord('model', '长');
              this.showResult('长');
            } else {
              this.appendChatRecord('model', '?');
              this.showResult('?');
            }
          }
        } else {
          console.error('Gemini 请求失败，没有返回有效结果', responseData);
          // 可能是 promptFeedback 拦截
          if (responseData.promptFeedback) {
             console.error('Prompt Feedback:', responseData.promptFeedback);
          }
          this.appendChatRecord('model', '?');
          this.showResult('?');
        }
      },
      fail: (err) => {
        console.error('云托管调用失败:', err);
        this.setData({ particleState: 'idle' });
        this.appendChatRecord('model', 'X');
        this.showResult('X');
        
        // 102002 是超时或系统错误
        if (err.errMsg && err.errMsg.includes('102002')) {
           wx.showToast({
             title: '连接超时，请重试',
             icon: 'none'
           });
        }
      },
      complete: () => {
        console.log('Gemini 请求结束');
        wx.hideLoading();
      }
    });
  },
  
  // 展示结果
  showResult(content) {
    this.resultSeq += 1;
    const holdMs = 5000;
    this.resultDisplayUntil = Date.now() + holdMs;
    this.resultRevealStart = Date.now();
    if (this.resultTimer) {
      clearTimeout(this.resultTimer);
      this.resultTimer = null;
    }
    this.setData({ 
      deepSeekResponse: content,
      particleState: 'showingResult' 
    });
    if (this.canvas && this.offscreenCtx) {
      this.updateParticlesTargets();
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.x = p.targetX;
        p.y = p.targetY;
        p.vx = 0;
        p.vy = 0;
      }
    }
    this.resultTimer = setTimeout(() => {
      this.setData({ particleState: 'idle' });
    }, holdMs);
  }
});
