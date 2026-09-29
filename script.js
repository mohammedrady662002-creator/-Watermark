/**
 * @file script.js
 * @description تطبيق علامة مائية متحركة (توقيع تيك توك)
 * كود JavaScript خالص بدون أي مكتبات خارجية
 */

// ============================================================================
// 1. كائن الإعدادات الشامل (CONFIG) - جميع القيم القابلة للتخصيص بتعليقات عربية
// ============================================================================
const CONFIG = {
  // بذرة العشوائية الثابتة لضمان تطابق حركة المعاينة 100% مع الفيديو المُصدّر
  seed: 12345,

  // إعدادات وسلوك العلامة المائية (توقيع تيك توك)
  watermark: {
    defaultPath: 'assets/logo.png', // مسار اللوجو الافتراضي على الخادم
    defaultSizePercent: 20,         // حجم اللوجو الافتراضي (20% من عرض الفيديو)
    minSizePercent: 6,              // الحد الأدنى لحجم اللوجو
    maxSizePercent: 30,             // الحد الأقصى لحجم اللوجو
    marginPercent: 5,               // هامش الأمان الداخلي من حواف الفيديو (5%)
    minInterval: 4.0,               // الحد الأدنى للفترة بين الانتقالات بالثواني (4 ثوانٍ)
    maxInterval: 7.0,               // الحد الأقصى للفترة بين الانتقالات بالثواني (7 ثوانٍ)
    minTransitDuration: 1.2,        // أدنى مدة لحركة الانتقال الانسيابية بالثواني
    maxTransitDuration: 1.8,        // أقصى مدة لحركة الانتقال الانسيابية بالثواني
    minPulseAlpha: 0.25,            // أقل قيمة لشفافية النبض
    defaultMaxPulseAlpha: 0.70,     // أقصى قيمة افتراضية لشفافية النبض (0.70)
    pulsePeriodSeconds: 3.2,        // مدة دورة النبض الكاملة بالثواني
    rotationMinDeg: -15,            // أدنى زاوية دوران عشوائية (بالدرجات)
    rotationMaxDeg: 15,             // أقصى زاوية دوران عشوائية (بالدرجات)
    scaleVariationMin: 0.90,        // أدنى مقياس تحجيم عشوائي
    scaleVariationMax: 1.15         // أقصى مقياس تحجيم عشوائي
  },

  // إعدادات التصدير والتسجيل
  export: {
    frameRate: 30,                  // معدل الإطارات الأساسي
    recorderTimeslice: 500,         // تقطيع بيانات التسجيل كل 500 ملي ثانية
    progressIntervalMs: 250,        // تحديث شريط التقدم والـ ETA كل 250 ملي ثانية
    endDelayMs: 250                 // تأخير تفريغ الإطارات الأخيرة عند انتهاء الفيديو
  },

  // تفضيلات صيغ التشفير بالترتيب من الأفضل للأوسع دعمًا
  mimePriority: [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ]
};

// ============================================================================
// 2. دوال الرياضيات وتوليد الأرقام العشوائية ذات البذرة الثابتة (Mulberry32)
// ============================================================================
function createMulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// 2. دوال الرياضيات والتسارع الفيزيائي المتطور (Advanced Physics & Easing Engine)
// ============================================================================
function createMulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// دالة التخفيف التكعيبي (Cubic Smooth)
function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// دالة التخفيف الخماسي فائق النعومة (Cinematic Quintic - Zero Jerk)
function easeInOutQuintic(x) {
  return x < 0.5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

// محاكاة ارتداد الزنبرك المرن التفاعلي (Magnetic Spring Bounce)
function springElastic(x) {
  if (x === 0) return 0;
  if (x === 1) return 1;
  const p = 0.38;
  const s = p / 4;
  return Math.pow(2, -10 * x) * Math.sin(((x - s) * (2 * Math.PI)) / p) + 1;
}

// دالة هيرميت الانسيابية الهادئة (Smooth Hermite)
function smoothHermite(x) {
  return x * x * (3 - 2 * x);
}

function applySelectedEasing(rawProgress, easingType) {
  const p = Math.min(1, Math.max(0, rawProgress));
  switch (easingType) {
    case 'quintic':
      return easeInOutQuintic(p);
    case 'spring':
      return springElastic(p);
    case 'smooth':
      return smoothHermite(p);
    case 'cubic':
    default:
      return easeInOutCubic(p);
  }
}

// ============================================================================
// 3. حالة التطبيق العامة (Application State)
// ============================================================================
const state = {
  // عناصر الفيديو والصورة
  sourceVideo: null,
  canvas: null,
  ctx: null,
  logoImg: new Image(),
  isLogoLoaded: false,
  logoDataUrl: '',
  originalVideoName: 'video',
  isVideoReady: false,
  videoFps: 30, // معدل إطارات الفيديو الأصلي
  
  // بارامترات التحكم من الواجهة
  logoSizePercent: CONFIG.watermark.defaultSizePercent,
  transitSpeedMultiplier: 1.0,
  pulseSpeedMultiplier: 1.0,
  maxPulseAlpha: CONFIG.watermark.defaultMaxPulseAlpha,
  
  // بارامترات الاستوديو الإبداعي الجديد
  movementPath: 'random', // 'random' | 'glide' | 'bounce' | 'orbit' | 'wave' | 'stealth'
  appearanceTemplate: 'neon', // 'neon' | 'cinematic' | 'shield' | 'glass' | 'flash' | 'water'
  easingType: 'quintic',   // 'quintic' | 'spring' | 'cubic' | 'smooth'
  microBreathing: true,    // تموج وتنفس حي دائم يمنع الجمود
  showPathPreview: false,  // إظهار مسار الحركة على الكانفس
  glowIntensity: 40,      // نسبة الظل والتوهج 0 - 100
  tiltMaxAngle: 8,        // أقصى زاوية ميلان بالدرجات
  activePreset: 'classic',
  isUsingCustomLogo: false,
  
  // المسار الزمني المحسوب مسبقًا للنقاط (Waypoints Timeline)
  waypoints: [],
  
  // حالة التشغيل والتسجيل
  isPlaying: false,
  isExporting: false,
  pausedVirtualTimeOffset: 0,
  lastPauseTimestamp: 0,
  
  // خادم الصوت الصامت أثناء التصدير
  audioCtx: null,
  audioSourceNode: null,
  audioDestNode: null,
  audioSpeakerGain: null,
  
  // كائن التسجيل النهائي
  mediaRecorder: null,
  recordedChunks: [],
  bestMimeType: '',
  exportedBlob: null,
  exportStartTime: 0,
  pendingExportAfterLogoPick: false
};

// ============================================================================
// 4. توليد المسار الزمني الثابت للعلامة المائية (Deterministic Creative Motion Timeline)
// ============================================================================
function generateWaypointsTimeline() {
  const rng = createMulberry32(CONFIG.seed);
  const waypoints = [];
  const maxTime = 10800; // مسار زمني يكفي حتى 3 ساعات من الفيديو
  
  let curTime = 0;
  let curX = 0.5; // يبدأ بالقرب من المنتصف
  let curY = 0.5;
  let curRot = 0;
  let curScale = 1.0;
  let cornerIdx = 0;
  let orbitAngle = 0;
  
  const cornerPositions = [
    { x: 0.10, y: 0.10 }, // أعلى اليمين (RTL)
    { x: 0.90, y: 0.88 }, // أسفل اليسار
    { x: 0.90, y: 0.10 }, // أعلى اليسار
    { x: 0.10, y: 0.88 }, // أسفل اليمين
    { x: 0.50, y: 0.12 }, // منتصف علوي
    { x: 0.50, y: 0.86 }  // منتصف سفلي
  ];

  const goldenAnchors = [
    { x: 0.14, y: 0.15 },
    { x: 0.86, y: 0.22 },
    { x: 0.84, y: 0.82 },
    { x: 0.16, y: 0.80 },
    { x: 0.78, y: 0.45 },
    { x: 0.22, y: 0.55 }
  ];
  
  while (curTime < maxTime) {
    let dwellDuration = 4.0;
    let transitDuration = 1.0;
    let nextX = 0.5, nextY = 0.5;
    
    if (state.movementPath === 'glide') {
      // انزلاق سينمائي: وقفات قصيرة وانتقالات طويلة ناعمة جداً
      dwellDuration = (2.2 + rng() * 1.6) / state.transitSpeedMultiplier;
      transitDuration = (1.6 + rng() * 1.2) / state.transitSpeedMultiplier;
      const g = goldenAnchors[cornerIdx % goldenAnchors.length];
      cornerIdx++;
      nextX = Math.max(0.08, Math.min(0.92, g.x + (rng() * 0.08 - 0.04)));
      nextY = Math.max(0.08, Math.min(0.92, g.y + (rng() * 0.08 - 0.04)));
    } else if (state.movementPath === 'bounce') {
      // ارتداد زنبركي: قفزة سريعة للأركان مع ثبات حركي
      dwellDuration = (3.2 + rng() * 2.2) / state.transitSpeedMultiplier;
      transitDuration = (0.75 + rng() * 0.4) / state.transitSpeedMultiplier;
      const c = cornerPositions[cornerIdx % 4];
      cornerIdx++;
      nextX = Math.max(0.07, Math.min(0.93, c.x + (rng() * 0.05 - 0.025)));
      nextY = Math.max(0.07, Math.min(0.93, c.y + (rng() * 0.05 - 0.025)));
    } else if (state.movementPath === 'orbit') {
      // مدار لانهائي: دوران فلكي متدفق على شكل مسار ليساجو
      dwellDuration = (1.8 + rng() * 1.2) / state.transitSpeedMultiplier;
      transitDuration = (1.5 + rng() * 1.0) / state.transitSpeedMultiplier;
      orbitAngle += 0.85 + rng() * 0.4;
      nextX = 0.5 + 0.38 * Math.sin(orbitAngle);
      nextY = 0.5 + 0.36 * Math.sin(orbitAngle * 2) * 0.9;
    } else if (state.movementPath === 'wave') {
      // تموج عائم: حركة مائية أورجانيك هادئة
      dwellDuration = (2.5 + rng() * 1.8) / state.transitSpeedMultiplier;
      transitDuration = (1.8 + rng() * 1.2) / state.transitSpeedMultiplier;
      const wavePhase = curTime * 0.35 + rng() * 0.5;
      nextX = 0.5 + 0.36 * Math.cos(wavePhase) + 0.05 * Math.sin(wavePhase * 2.3);
      nextY = 0.5 + 0.36 * Math.sin(wavePhase * 1.2) + 0.04 * Math.cos(wavePhase * 1.9);
    } else if (state.movementPath === 'stealth') {
      // شبح ذكي: وقفات طويلة وتلاشٍ سريع فجائي
      dwellDuration = (5.5 + rng() * 3.0) / state.transitSpeedMultiplier;
      transitDuration = (0.65 + rng() * 0.35) / state.transitSpeedMultiplier;
      const c = cornerPositions[cornerIdx % 4];
      cornerIdx += (1 + Math.floor(rng() * 2));
      nextX = c.x;
      nextY = c.y;
    } else {
      // عشوائي تيك توك كلاسيك
      const rawInterval = CONFIG.watermark.minInterval + rng() * (CONFIG.watermark.maxInterval - CONFIG.watermark.minInterval);
      dwellDuration = rawInterval / state.transitSpeedMultiplier;
      transitDuration = (CONFIG.watermark.minTransitDuration + rng() * (CONFIG.watermark.maxTransitDuration - CONFIG.watermark.minTransitDuration)) / state.transitSpeedMultiplier;
      
      const c = cornerPositions[cornerIdx % cornerPositions.length];
      cornerIdx++;
      nextX = Math.max(0.08, Math.min(0.92, c.x + (rng() * 0.12 - 0.06)));
      nextY = Math.max(0.08, Math.min(0.92, c.y + (rng() * 0.12 - 0.06)));
    }
    
    const dwellEnd = curTime + dwellDuration;
    const transitEnd = dwellEnd + transitDuration;
    
    // زاوية دوران ديناميكية
    const tiltDeg = (rng() * 2 - 1) * state.tiltMaxAngle;
    const nextRot = tiltDeg * (Math.PI / 180);
    
    // مقياس حجم متنوع
    const nextScale = CONFIG.watermark.scaleVariationMin + rng() * (CONFIG.watermark.scaleVariationMax - CONFIG.watermark.scaleVariationMin);
    
    waypoints.push({
      startTime: curTime,
      dwellEnd: dwellEnd,
      transitEnd: transitEnd,
      transitDuration: transitDuration,
      startX: curX,
      startY: curY,
      startRot: curRot,
      startScale: curScale,
      targetX: nextX,
      targetY: nextY,
      targetRot: nextRot,
      targetScale: nextScale
    });
    
    curTime = transitEnd;
    curX = nextX;
    curY = nextY;
    curRot = nextRot;
    curScale = nextScale;
  }
  
  state.waypoints = waypoints;
}

/**
 * حساب حالة العلامة المائية عند أي ثانية t بدقة وفيزيائية مطلقة
 */
function getWatermarkStateAtTime(t) {
  if (state.waypoints.length === 0) {
    generateWaypointsTimeline();
  }
  
  const safeT = Math.max(0, t);
  let low = 0;
  let high = state.waypoints.length - 1;
  let seg = state.waypoints[0];
  
  // بحث ثنائي فائق السرعة O(log N)
  while (low <= high) {
    const mid = (low + high) >> 1;
    const item = state.waypoints[mid];
    if (safeT >= item.startTime && safeT < item.transitEnd) {
      seg = item;
      break;
    } else if (safeT < item.startTime) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  
  let xRatio = seg.startX;
  let yRatio = seg.startY;
  let rot = seg.startRot;
  let scale = seg.startScale;
  let transitProgress = 0;
  let isMoving = false;
  
  if (safeT >= seg.dwellEnd && safeT < seg.transitEnd && seg.transitDuration > 0) {
    isMoving = true;
    transitProgress = (safeT - seg.dwellEnd) / seg.transitDuration;
    const eased = applySelectedEasing(transitProgress, state.easingType);
    
    xRatio = seg.startX + (seg.targetX - seg.startX) * eased;
    yRatio = seg.startY + (seg.targetY - seg.startY) * eased;
    rot = seg.startRot + (seg.targetRot - seg.startRot) * eased;
    scale = seg.startScale + (seg.targetScale - seg.startScale) * eased;
    
    // ميلان حركي ذكي يتجه تلقائياً مع زاوية وسرعة السير (Dynamic Directional Banking)
    if (state.tiltMaxAngle > 0) {
      const travelDirX = Math.sign(seg.targetX - seg.startX) || 1;
      const bankFactor = Math.sin(transitProgress * Math.PI); // قمة الميلان في منتصف المسافة
      rot += travelDirX * (state.tiltMaxAngle * (Math.PI / 180)) * bankFactor * 0.8;
    }
  } else if (safeT >= seg.transitEnd) {
    xRatio = seg.targetX;
    yRatio = seg.targetY;
    rot = seg.targetRot;
    scale = seg.targetScale;
  }
  
  // التنفس والطفو الحي (Living Micro-Breathing): تموج لطيف مجهري يمنع الجمود نهائياً
  if (state.microBreathing) {
    const breatheFloatX = Math.sin(safeT * 2.1) * 0.0035;
    const breatheFloatY = Math.cos(safeT * 1.7) * 0.0045;
    const breatheScale = Math.sin(safeT * 2.4) * 0.016; // تنفس 1.6% طبيعي
    xRatio += breatheFloatX;
    yRatio += breatheFloatY;
    scale *= (1 + breatheScale);
  }
  
  // حساب نبض الشفافية الجيبي المستمر
  const pulseFreq = (2 * Math.PI) / (CONFIG.watermark.pulsePeriodSeconds / state.pulseSpeedMultiplier);
  const sineFactor = (Math.sin(safeT * pulseFreq) + 1) / 2; // بين 0 و 1
  let alpha = CONFIG.watermark.minPulseAlpha + sineFactor * (state.maxPulseAlpha - CONFIG.watermark.minPulseAlpha);
  
  // تأثير التلاشي الشبحي (Stealth Warp Teleport)
  if (state.movementPath === 'stealth' && isMoving) {
    const warpAlpha = Math.abs(transitProgress - 0.5) * 2;
    alpha *= Math.max(0.04, warpAlpha);
  }
  
  // تطبيق تمبلتس ظهور ومظهر اللوجو الاحترافية (Logo Appearance Templates)
  const appTemplate = state.appearanceTemplate || 'neon';
  if (appTemplate === 'neon') {
    // نيون تيك توك: نبض قوي حيوي بين 0.65 و 0.95
    alpha = 0.65 + sineFactor * 0.30;
  } else if (appTemplate === 'cinematic') {
    // تنفس سينمائي: زووم هادئ وتنفس فخم
    const cineBreath = Math.sin(safeT * 1.8) * 0.04;
    scale *= (1 + cineBreath);
    alpha = 0.62 + sineFactor * 0.22;
  } else if (appTemplate === 'shield') {
    // درع حماية: شفافية ثابتة وبارزة 92% مانعة للاقتصاص والسرقة
    alpha = 0.92;
  } else if (appTemplate === 'glass') {
    // كريستال نقي: مظهر زجاجي شفاف 48% راقٍ كالقنوات التلفزيونية
    alpha = 0.44 + sineFactor * 0.10;
  } else if (appTemplate === 'flash') {
    // وميض خاطف: وميض ونبضات ضوئية خاطفة دورية كل 2.5 ثانية
    const flashCycle = (safeT * 1.5) % 2.5;
    if (flashCycle < 0.35) {
      alpha = 0.98;
      scale *= 1.07;
    } else {
      alpha = 0.58 + sineFactor * 0.15;
    }
  } else if (appTemplate === 'water') {
    // طفو مائي: تمايل مائي انسيابي ونعومة متدفقة
    rot += Math.sin(safeT * 1.8) * 0.04;
    scale *= (1 + Math.cos(safeT * 1.5) * 0.025);
    alpha = 0.52 + sineFactor * 0.22;
  }
  
  return { xRatio, yRatio, rot, scale, alpha, isMoving, transitProgress };
}

// ============================================================================
// 5. فحص صيغ التسجيل المدعومة في المتصفح
// ============================================================================
function detectBestSupportedMimeType() {
  for (const mime of CONFIG.mimePriority) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch (e) {
      // الاستمرار في فحص الصيغة التالية
    }
  }
  return 'video/webm';
}

function updateMimeChip() {
  const mimeChip = document.getElementById('mimeChip');
  const mimeText = document.getElementById('mimeChipText');
  state.bestMimeType = detectBestSupportedMimeType();
  
  if (state.bestMimeType.includes('mp4')) {
    mimeText.textContent = 'MP4 ✅ جاهز لتيك توك';
    mimeChip.style.borderColor = 'rgba(37, 244, 238, 0.4)';
    mimeChip.style.color = '#25f4ee';
  } else {
    mimeText.textContent = 'WebM ✅ جودة فائقة';
    mimeChip.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    mimeChip.style.color = '#34d399';
  }
}

// ============================================================================
// 6. فحص أمان الكانفس (Canvas Origin Clean Check)
// ============================================================================
/**
 * إنشاء كانفس جديد ونظيف 100% في DOM لإزالة أي تلوث أمني متبقٍ
 */
function resetToFreshCanvas() {
  const oldCanvas = state.canvas;
  if (!oldCanvas) return null;
  
  const parent = oldCanvas.parentElement;
  const newCanvas = document.createElement('canvas');
  newCanvas.id = oldCanvas.id;
  newCanvas.className = oldCanvas.className;
  newCanvas.width = oldCanvas.width || 1080;
  newCanvas.height = oldCanvas.height || 1080;
  newCanvas.style.cssText = oldCanvas.style.cssText;
  
  if (parent) {
    parent.replaceChild(newCanvas, oldCanvas);
  }
  state.canvas = newCanvas;
  state.ctx = newCanvas.getContext('2d');
  
  return newCanvas;
}

/**
 * فحص هل الكانفس آمن وغير ملوث قبل بدء التصدير
 */
function isCanvasOriginClean(targetCanvas) {
  if (!targetCanvas) return false;
  try {
    const testCtx = targetCanvas.getContext('2d');
    testCtx.getImageData(0, 0, 1, 1);
    return true;
  } catch (err) {
    return false;
  }
}

function showSecurityTaintModal() {
  const modal = document.getElementById('securityTaintModal');
  if (modal) modal.style.display = 'flex';
}

function hideSecurityTaintModal() {
  const modal = document.getElementById('securityTaintModal');
  if (modal) modal.style.display = 'none';
}

// ============================================================================
// 7. إدارة ملفات اللوجو والفيديو
// ============================================================================

/**
 * تحميل وتطبيق اللوجو الافتراضي الأصلي PNG من الاستس (PNG فقط وليس SVG)
 */
/**
 * تحميل وتطبيق اللوجو الافتراضي مباشرة من مجلد assets
 * يدعم كلاً من Data URL المحول تلقائياً من assets/logo.js أو الملف المباشر assets/logo.png
 */
function loadDefaultLogo(forceRefresh = false) {
  const logoThumb = document.getElementById('logoThumbnailImg');
  const logoStatusBadge = document.getElementById('logoStatusBadge');
  const logoFileName = document.getElementById('logoFileName');
  const logoDimensions = document.getElementById('logoDimensions');
  const resetBtn = document.getElementById('resetDefaultLogoBtn');
  
  // الأولوية الأولى: إذا كان اللوجو محملاً من assets/logo.js كـ Data URL نقي 100%
  if (typeof window !== 'undefined' && window.ASSETS_LOGO_DATA) {
    const img = new Image();
    img.onload = () => {
      state.logoImg = img;
      state.isLogoLoaded = true;
      state.isUsingCustomLogo = false;
      state.logoDataUrl = window.ASSETS_LOGO_DATA;
      
      resetToFreshCanvas();
      
      if (logoThumb) logoThumb.src = img.src;
      if (logoStatusBadge) {
        logoStatusBadge.textContent = 'لوجو assets/logo.png مطبق وجاهز ✅';
        logoStatusBadge.style.color = '#34d399';
      }
      if (logoFileName) logoFileName.textContent = 'assets/logo.png (الافتراضي)';
      if (logoDimensions) logoDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight} بكسل (نقي للتصدير)`;
      if (resetBtn) resetBtn.style.display = 'none';
      
      if (forceRefresh) {
        showToast('تمت قراءة وتطبيق اللوجو من assets/logo.png بنجاح ✅', 'success');
      }
      
      if (state.canvas && state.ctx) {
        drawCanvasFrame(state.sourceVideo ? state.sourceVideo.currentTime : 0);
      }
    };
    img.src = window.ASSETS_LOGO_DATA;
    return;
  }
  
  // الأولوية الثانية: قراءة ملف assets/logo.png مباشرة من المجلد
  const timestamp = Date.now();
  const logoPath = `assets/logo.png?t=${timestamp}`;
  
  const img = new Image();
  img.onload = () => {
    state.logoImg = img;
    state.isLogoLoaded = true;
    state.isUsingCustomLogo = false;
    
    if (logoThumb) logoThumb.src = img.src;
    if (logoStatusBadge) {
      logoStatusBadge.textContent = 'لوجو assets/logo.png مطبق ✅';
      logoStatusBadge.style.color = '#34d399';
    }
    if (logoFileName) logoFileName.textContent = 'assets/logo.png';
    if (logoDimensions) logoDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight} بكسل`;
    if (resetBtn) resetBtn.style.display = 'none';
    
    if (forceRefresh) {
      showToast('تمت قراءة وتحديث اللوجو من assets/logo.png بنجاح ✅', 'success');
    }
    
    if (state.canvas && state.ctx) {
      drawCanvasFrame(state.sourceVideo ? state.sourceVideo.currentTime : 0);
    }
  };
  
  img.onerror = () => {
    const directImg = new Image();
    directImg.onload = () => {
      state.logoImg = directImg;
      state.isLogoLoaded = true;
      state.isUsingCustomLogo = false;
      if (logoThumb) logoThumb.src = directImg.src;
      if (logoStatusBadge) {
        logoStatusBadge.textContent = 'لوجو assets/logo.png مطبق ✅';
        logoStatusBadge.style.color = '#34d399';
      }
      if (logoFileName) logoFileName.textContent = 'assets/logo.png';
      if (logoDimensions) logoDimensions.textContent = `${directImg.naturalWidth} × ${directImg.naturalHeight} بكسل`;
      if (resetBtn) resetBtn.style.display = 'none';
      if (forceRefresh) {
        showToast('تمت قراءة وتحديث اللوجو من assets/logo.png بنجاح ✅', 'success');
      }
      if (state.canvas && state.ctx) {
        drawCanvasFrame(state.sourceVideo ? state.sourceVideo.currentTime : 0);
      }
    };
    directImg.onerror = () => {
      if (logoStatusBadge) {
        logoStatusBadge.textContent = 'يرجى وضع logo.png داخل مجلد assets';
        logoStatusBadge.style.color = '#f87171';
      }
      if (forceRefresh) {
        showToast('تعذر العثور على ملف assets/logo.png في المجلد', 'error');
      }
    };
    directImg.src = 'assets/logo.png';
  };
  
  img.src = logoPath;
}

/**
 * إنشاء لوجو دكان إيلين المتجهي فائق النقاء كـ Data URL مدمج ومضمون
 */
function generateFallbackLogoDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <defs>
      <radialGradient id="bgGrad" cx="50%" cy="45%" r="50%">
        <stop offset="0%" stop-color="#fff9f6" />
        <stop offset="70%" stop-color="#fcefe8" />
        <stop offset="100%" stop-color="#f5ded5" />
      </radialGradient>
      <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e8bf65" />
        <stop offset="25%" stop-color="#fceec2" />
        <stop offset="50%" stop-color="#c99532" />
        <stop offset="75%" stop-color="#fceec2" />
        <stop offset="100%" stop-color="#b07d1e" />
      </linearGradient>
      <linearGradient id="roseGrad" x1="0%" y1="0%" x2="100%" y2="50%">
        <stop offset="0%" stop-color="#e2336e" />
        <stop offset="100%" stop-color="#b81b50" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.18" />
      </filter>
    </defs>
    <circle cx="256" cy="256" r="248" fill="url(#goldRim)" filter="url(#shadow)" />
    <circle cx="256" cy="256" r="236" fill="#7a5518" />
    <circle cx="256" cy="256" r="232" fill="url(#goldRim)" />
    <circle cx="256" cy="256" r="222" fill="url(#bgGrad)" />
    <circle cx="256" cy="256" r="218" fill="none" stroke="#f1cb89" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6" />
    
    <!-- Lady with Hat Silhouette -->
    <g transform="translate(60, 60)" filter="url(#shadow)">
      <path d="M 50 120 C 65 60, 160 55, 185 105 C 205 110, 215 125, 210 135 C 190 150, 70 150, 45 135 Z" fill="#f79bb7" />
      <path d="M 68 115 C 100 100, 150 100, 180 115 C 170 122, 100 125, 68 115 Z" fill="#1e1e1e" />
      <ellipse cx="85" cy="120" rx="14" ry="9" fill="#1e1e1e" transform="rotate(-15, 85, 120)" />
      <path d="M 125 125 C 145 145, 155 170, 140 195 C 132 195, 125 185, 125 175 C 120 170, 115 175, 112 185 C 105 180, 100 170, 102 160 C 105 150, 115 140, 125 125 Z" fill="#fdd8c7" />
      <circle cx="123" cy="180" r="4.5" fill="#f3be3a" stroke="#a2750e" stroke-width="1" />
      <path d="M 70 125 C 90 140, 100 165, 85 195 C 75 215, 95 240, 110 245 C 90 240, 70 215, 65 190 C 60 170, 50 145, 70 125 Z" fill="#1e1e1e" />
    </g>

    <!-- Baby Dress -->
    <g transform="translate(325, 75)" filter="url(#shadow)">
      <path d="M 28 35 C 20 15, 36 5, 46 15 C 50 22, 45 28, 43 35" fill="none" stroke="#ba8c46" stroke-width="3" stroke-linecap="round" />
      <path d="M 5 45 L 43 35 L 81 45 Z" fill="#cfa55e" stroke="#ba8c46" stroke-width="1.5" />
      <path d="M 18 48 C 25 46, 61 46, 68 48 L 78 68 C 70 70, 65 65, 60 62 L 66 115 C 43 122, 33 122, 20 115 L 26 62 C 21 65, 16 70, 8 68 Z" fill="#f7a7bf" />
      <rect x="36" y="65" width="14" height="9" rx="3" fill="#e885a3" />
      <circle cx="43" cy="69" r="3" fill="#ffffff" />
    </g>

    <!-- Cute Teddy Bear -->
    <g transform="translate(385, 160)" filter="url(#shadow)">
      <circle cx="35" cy="50" r="22" fill="#d29e6c" />
      <circle cx="35" cy="25" r="18" fill="#dfae7c" />
      <circle cx="21" cy="12" r="7" fill="#dfae7c" />
      <circle cx="21" cy="12" r="4" fill="#f1c79a" />
      <circle cx="49" cy="12" r="7" fill="#dfae7c" />
      <circle cx="49" cy="12" r="4" fill="#f1c79a" />
      <ellipse cx="35" cy="28" rx="8" ry="6" fill="#f7ddbe" />
      <ellipse cx="35" cy="26" rx="3" ry="2" fill="#3a2512" />
      <circle cx="29" cy="21" r="2" fill="#222" />
      <circle cx="41" cy="21" r="2" fill="#222" />
      <path d="M 30 38 L 40 44 L 40 38 L 30 44 Z" fill="#f07297" />
    </g>

    <!-- Golden Crown -->
    <g transform="translate(230, 205)">
      <path d="M 8 24 L 0 8 L 13 14 L 26 2 L 39 14 L 52 8 L 44 24 Z" fill="url(#goldRim)" filter="url(#shadow)" />
      <circle cx="0" cy="8" r="2.5" fill="#fceec2" />
      <circle cx="26" cy="2" r="3" fill="#fceec2" />
      <circle cx="52" cy="8" r="2.5" fill="#fceec2" />
    </g>

    <!-- Dokan Eileen typography -->
    <g transform="translate(256, 315)" text-anchor="middle" filter="url(#shadow)">
      <text x="0" y="0" font-family="'Tajawal', sans-serif" font-weight="900" font-size="62">
        <tspan fill="#1e1e1e">دكان </tspan>
        <tspan fill="url(#roseGrad)">إيلين</tspan>
      </text>
    </g>

    <!-- Heart divider -->
    <g transform="translate(256, 342)" filter="url(#shadow)">
      <path d="M 0 6 C -2 0, -10 -2, -10 4 C -10 10, 0 17, 0 17 C 0 17, 10 10, 10 4 C 10 -2, 2 0, 0 6 Z" fill="#e2336e" />
      <line x1="-130" y1="10" x2="-20" y2="10" stroke="#c99532" stroke-width="2" stroke-linecap="round" />
      <line x1="20" y1="10" x2="130" y2="10" stroke="#c99532" stroke-width="2" stroke-linecap="round" />
    </g>

    <g transform="translate(256, 388)" text-anchor="middle">
      <text x="0" y="0" font-family="'Tajawal', sans-serif" font-weight="800" font-size="25" fill="#242424">
        ملابس حريمي وأطفال
      </text>
    </g>

    <!-- Bottom hanger -->
    <g transform="translate(256, 420)">
      <line x1="-60" y1="18" x2="-25" y2="18" stroke="#ba8c46" stroke-width="2" stroke-linecap="round" />
      <line x1="25" y1="18" x2="60" y2="18" stroke="#ba8c46" stroke-width="2" stroke-linecap="round" />
      <path d="M 0 0 C -4 -10, 4 -16, 8 -9 C 10 -4, 6 0, 0 5 L -20 18 L 20 18 Z" fill="none" stroke="#ba8c46" stroke-width="2.5" stroke-linejoin="round" />
      <path d="M 0 9 C -1 6, -5 5, -5 8 C -5 11, 0 15, 0 15 C 0 15, 5 11, 5 8 C 5 5, 1 6, 0 9 Z" fill="#e2336e" />
    </g>
  </svg>`;

  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const img = new Image();
  img.onload = () => {
    state.logoImg = img;
    state.isLogoLoaded = true;
    const thumb = document.getElementById('logoThumbnailImg');
    const badge = document.getElementById('logoStatusBadge');
    const fName = document.getElementById('logoFileName');
    const dims = document.getElementById('logoDimensions');
    const dropzone = document.getElementById('logoDropzone');
    if (thumb) thumb.src = dataUrl;
    if (badge) {
      badge.textContent = 'لوجو إيلين الافتراضي ✅';
      badge.style.color = '#34d399';
    }
    if (fName) fName.textContent = 'دكان إيلين (افتراضي جاهز)';
    if (dims) dims.textContent = '512 × 512 بكسل (عالي الدقة)';
    if (dropzone) dropzone.classList.add('filled');
  };
  img.src = dataUrl;
}

/**
 * قراءة اللوجو المرفوع من المستخدم حصريًا عبر FileReader كـ Data URL لمنع تلوين الكانفس
 */
function handleUserLogoFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('يرجى اختيار ملف صورة صالح (PNG, JPG, SVG)', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const img = new Image();
    img.onload = () => {
      state.logoImg = img;
      state.isLogoLoaded = true;
      state.logoDataUrl = dataUrl;
      
      const logoThumb = document.getElementById('logoThumbnailImg');
      const logoStatusBadge = document.getElementById('logoStatusBadge');
      const logoFileName = document.getElementById('logoFileName');
      const logoDimensions = document.getElementById('logoDimensions');
      const dropzone = document.getElementById('logoDropzone');
      
      logoThumb.src = dataUrl;
      logoStatusBadge.textContent = 'لوجو مخصص ✅';
      logoStatusBadge.style.color = '#34d399';
      logoFileName.textContent = file.name;
      logoDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight} بكسل`;
      dropzone.classList.add('filled');
      
      state.isUsingCustomLogo = true;
      const resetBtn = document.getElementById('resetDefaultLogoBtn');
      if (resetBtn) resetBtn.style.display = 'inline-flex';
      
      // استبدال الكانفس بكانفس جديد كلياً لضمان Origin-Clean: true بنسبة 100%
      resetToFreshCanvas();
      if (state.canvas && state.ctx) {
        drawCanvasFrame(state.sourceVideo ? state.sourceVideo.currentTime : 0);
      }
      
      showToast(`تم تعيين اللوجو: ${file.name} بنجاح`, 'success');
      
      // إذا كان التصدير معلقاً في انتظار إذن أمان المتصفح، ابدأ التصدير فوراً
      if (state.pendingExportAfterLogoPick) {
        state.pendingExportAfterLogoPick = false;
        hideSecurityTaintModal();
        showToast('تم منح إذن أمان المتصفح بنجاح! جاري بدء التصدير...', 'info');
        setTimeout(() => {
          startVideoExport();
        }, 150);
      }
    };
    img.src = dataUrl;
  };
  reader.onerror = () => {
    showToast('حدث خطأ أثناء قراءة ملف اللوجو', 'error');
  };
  reader.readAsDataURL(file);
}

/**
 * معالجة اختيار ملف الفيديو
 */
function handleUserVideoFile(file) {
  if (!file || !file.type.startsWith('video/')) {
    showToast('يرجى اختيار ملف فيديو صالح (MP4, WebM, MOV)', 'error');
    return;
  }
  
  const video = state.sourceVideo;
  const fileUrl = URL.createObjectURL(file);
  state.originalVideoName = file.name.replace(/\.[^/.]+$/, "");
  
  video.src = fileUrl;
  video.load();
  
  showToast('جاري تحميل وقراءة بيانات الفيديو...', 'info');
  
  video.onloadedmetadata = () => {
    state.isVideoReady = true;
    setupCanvasDimensions();
    detectVideoFramerate(video);
    
    // تحديث بيانات الفيديو في الواجهة
    const videoDropzone = document.getElementById('videoDropzone');
    const videoInfoPill = document.getElementById('videoInfoPill');
    const videoNameText = document.getElementById('videoNameText');
    const videoDimText = document.getElementById('videoDimText');
    const videoDurationText = document.getElementById('videoDurationText');
    const openExportBtn = document.getElementById('openExportModalBtn');
    const placeholder = document.getElementById('canvasPlaceholder');
    
    if (videoDropzone) videoDropzone.classList.add('filled');
    if (videoInfoPill) videoInfoPill.classList.add('show');
    if (videoNameText) videoNameText.textContent = file.name;
    if (videoDimText) videoDimText.textContent = `${video.videoWidth} × ${video.videoHeight} (${formatTime(video.duration)})`;
    if (videoDurationText) videoDurationText.textContent = formatTime(video.duration);
    if (openExportBtn) openExportBtn.removeAttribute('disabled');
    if (placeholder) placeholder.style.display = 'none';
    
    // تجهيز مسار الحركة المتطابق
    generateWaypointsTimeline();
    
    // تشغيل تلقائي أولي للمعاينة
    video.currentTime = 0;
    video.play().then(() => {
      state.isPlaying = true;
      updatePlayPauseButton();
    }).catch(() => {
      state.isPlaying = false;
      updatePlayPauseButton();
    });
    
    showToast('تم تحميل الفيديو بنجاح! يمكنك الآن مشاهدة المعاينة الحية والتصدير.', 'success');
  };
  
  video.onerror = () => {
    showToast('تعذر فك تشفير الفيديو. قد تكون الصيغة غير مدعومة من متصفحك.', 'error');
  };
}

/**
 * توليد فيديو تجريبي توضيحي سريع
 */
function loadDemoVideoClip() {
  showToast('جاري إنشاء فيديو تجريبي توضيحي سريع...', 'info');
  
  const demoCanvas = document.createElement('canvas');
  demoCanvas.width = 1080;
  demoCanvas.height = 1080;
  const dCtx = demoCanvas.getContext('2d');
  
  const stream = demoCanvas.captureStream(30);
  const mime = detectBestSupportedMimeType();
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks = [];
  
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  
  recorder.onstop = () => {
    const demoBlob = new Blob(chunks, { type: mime });
    const demoFile = new File([demoBlob], 'demo_video.mp4', { type: mime });
    handleUserVideoFile(demoFile);
  };
  
  recorder.start();
  
  let frame = 0;
  const totalFrames = 180; // 6 ثوانٍ بمعدل 30 إطار
  
  const interval = setInterval(() => {
    frame++;
    const t = frame / 30;
    
    // رسم خلفية تدرج نيون متحركة
    const grad = dCtx.createLinearGradient(0, 0, 1080, 1080);
    const hue = (frame * 2) % 360;
    grad.addColorStop(0, `hsl(${hue}, 70%, 15%)`);
    grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 80%, 8%)`);
    dCtx.fillStyle = grad;
    dCtx.fillRect(0, 0, 1080, 1080);
    
    // أشكال هندسية راقصة
    dCtx.save();
    dCtx.translate(540, 540);
    dCtx.rotate(t * 0.8);
    dCtx.strokeStyle = 'rgba(37, 244, 238, 0.4)';
    dCtx.lineWidth = 6;
    dCtx.strokeRect(-250, -250, 500, 500);
    
    dCtx.rotate(-t * 1.6);
    dCtx.strokeStyle = 'rgba(254, 44, 85, 0.4)';
    dCtx.lineWidth = 4;
    dCtx.beginPath();
    dCtx.arc(0, 0, 320, 0, Math.PI * 2);
    dCtx.stroke();
    dCtx.restore();
    
    // نص وسطي
    dCtx.fillStyle = '#ffffff';
    dCtx.font = 'bold 54px Tajawal, sans-serif';
    dCtx.textAlign = 'center';
    dCtx.fillText('فيديو تجريبي - Rady Watermark', 540, 510);
    
    dCtx.fillStyle = '#25f4ee';
    dCtx.font = 'bold 36px Tajawal, sans-serif';
    dCtx.fillText(`الزمن: ${t.toFixed(1)} ثانية`, 540, 580);
    
    if (frame >= totalFrames) {
      clearInterval(interval);
      recorder.stop();
    }
  }, 1000 / 30);
}

// ============================================================================
// 8. ضبط أبعاد الكانفس وكشف معدل الإطارات (FPS) لمطابقة الجودة الأصلية 100%
// ============================================================================
/**
 * كشف وقياس معدل إطارات الفيديو (FPS) الأصلي وضمان التصدير بأعلى FPS
 */
function detectVideoFramerate(video) {
  state.videoFps = 30; // قيمة مبدئية
  
  if ('requestVideoFrameCallback' in video) {
    let frameCount = 0;
    let initialMediaTime = null;
    let finalMediaTime = null;
    
    const onFrame = (now, metadata) => {
      if (initialMediaTime === null) {
        initialMediaTime = metadata.mediaTime;
      } else {
        finalMediaTime = metadata.mediaTime;
        frameCount++;
      }
      
      if (frameCount >= 12 && finalMediaTime > initialMediaTime) {
        const measuredFps = Math.round(frameCount / (finalMediaTime - initialMediaTime));
        const standardFramerates = [24, 25, 30, 48, 50, 60, 120];
        const closestFps = standardFramerates.reduce((prev, curr) =>
          Math.abs(curr - measuredFps) < Math.abs(prev - measuredFps) ? curr : prev
        );
        state.videoFps = closestFps;
        
        const exportFpsBadgeText = document.getElementById('exportFpsBadgeText');
        if (exportFpsBadgeText) {
          exportFpsBadgeText.textContent = `🎯 مطابق للمصدر (${state.videoFps} FPS Match Source)`;
        }
        
        const exportFpsText = document.getElementById('exportFpsText');
        if (exportFpsText) {
          exportFpsText.textContent = `معدل الإطارات: ${state.videoFps} FPS (تطابق تام مع المصدر 100%)`;
        }
        return;
      }
      
      if (frameCount < 25 && !video.paused) {
        video.requestVideoFrameCallback(onFrame);
      }
    };
    
    video.requestVideoFrameCallback(onFrame);
  }
}

function setupCanvasDimensions() {
  const video = state.sourceVideo;
  const canvas = state.canvas;
  
  // الحفاظ على الأبعاد الحقيقية الكاملة للفيديو دون أي تصغير أو تقليل في الجودة
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  
  canvas.width = w;
  canvas.height = h;
}

// ============================================================================
// 9. حلقة الرسم على الكانفس (Render Loop)
// ============================================================================
// ============================================================================
// 9. حلقة الرسم على الكانفس ومزامنة الفريمات (Render Loop & Frame Drawing)
// ============================================================================
function drawMotionPathPreview(ctx, canvas, timeInSeconds, safeWidth, safeHeight, marginX, marginY) {
  if (state.waypoints.length === 0) return;
  
  ctx.save();
  ctx.lineWidth = Math.max(2, Math.round(canvas.width * 0.0025));
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(37, 244, 238, 0.4)';
  ctx.shadowColor = '#25f4ee';
  ctx.shadowBlur = 8;
  
  // رسم منحنى مسار الحركة المتدفق للأمام
  ctx.beginPath();
  const sampleCount = 60;
  for (let i = 0; i <= sampleCount; i++) {
    const t = timeInSeconds + (i / sampleCount) * 10;
    const p = getWatermarkStateAtTime(t);
    const px = marginX + p.xRatio * safeWidth;
    const py = marginY + p.yRatio * safeHeight;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  
  // رسم نقاط التوقف (Waypoints Anchors)
  for (let i = 0; i < Math.min(6, state.waypoints.length); i++) {
    const wp = state.waypoints[i];
    const ax = marginX + wp.targetX * safeWidth;
    const ay = marginY + wp.targetY * safeHeight;
    ctx.beginPath();
    ctx.arc(ax, ay, Math.max(4, Math.round(canvas.width * 0.005)), 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? '#fe2c55' : '#25f4ee';
    ctx.shadowBlur = 6;
    ctx.fill();
  }
  ctx.restore();
}

function updateTelemetryBar(wm) {
  const modeEl = document.getElementById('telemetryModeText');
  const posEl = document.getElementById('telemetryPosText');
  const stateEl = document.getElementById('telemetryStateText');
  
  if (modeEl) {
    const modeNames = {
      random: 'حركة: تيك توك 🎵',
      glide: 'حركة: انزلاق 🚀',
      bounce: 'حركة: ارتداد ⚡',
      orbit: 'حركة: مدار ♾️',
      wave: 'حركة: أمواج 🌊',
      stealth: 'حركة: شبح 👻'
    };
    modeEl.textContent = modeNames[state.movementPath] || 'حركة: تيك توك';
  }
  
  if (posEl) {
    const px = Math.round(wm.xRatio * 100);
    const py = Math.round(wm.yRatio * 100);
    posEl.textContent = `X: ${px}% · Y: ${py}%`;
  }
  
  if (stateEl) {
    const appNames = {
      neon: 'مظهر: نيون متوهج ✨',
      cinematic: 'مظهر: تنفس سينمائي 🎬',
      shield: 'مظهر: درع حماية 🛡️',
      glass: 'مظهر: كريستال نقي 💎',
      flash: 'مظهر: وميض خاطف ⚡',
      water: 'مظهر: طفو مائي 💧'
    };
    stateEl.textContent = appNames[state.appearanceTemplate] || 'مظهر: نيون';
    stateEl.style.color = state.appearanceTemplate === 'shield' ? 'var(--tiktok-pink)' : 'var(--tiktok-cyan)';
  }
}

function drawCanvasFrame(timeInSeconds) {
  const canvas = state.canvas;
  const ctx = state.ctx;
  const video = state.sourceVideo;
  
  if (!state.isVideoReady || video.readyState < 2) return;
  
  // 1. رسم فريم الفيديو بدقة المصدر الأصلية 100%
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // 2. حساب ورسم العلامة المائية عند هذا الزمن الدقيق
  if (state.isLogoLoaded && state.logoImg.naturalWidth > 0) {
    const wm = getWatermarkStateAtTime(timeInSeconds);
    
    const logoWidth = canvas.width * (state.logoSizePercent / 100) * wm.scale;
    const logoAspect = state.logoImg.naturalHeight / state.logoImg.naturalWidth;
    const logoHeight = logoWidth * logoAspect;
    
    const marginX = canvas.width * (CONFIG.watermark.marginPercent / 100) + logoWidth / 2;
    const marginY = canvas.height * (CONFIG.watermark.marginPercent / 100) + logoHeight / 2;
    
    const safeWidth = Math.max(0, canvas.width - marginX * 2);
    const safeHeight = Math.max(0, canvas.height - marginY * 2);
    
    const posX = marginX + wm.xRatio * safeWidth;
    const posY = marginY + wm.yRatio * safeHeight;
    
    // 3. رسم خطوط مسار الحركة التفاعلية إن كانت مفعلة في المعاينة
    if (state.showPathPreview && !state.isExporting) {
      drawMotionPathPreview(ctx, canvas, timeInSeconds, safeWidth, safeHeight, marginX, marginY);
    }
    
    ctx.save();
    ctx.translate(posX, posY);
    ctx.rotate(wm.rot);
    ctx.globalAlpha = Math.min(1, Math.max(0.04, wm.alpha));
    
    // 4. تطبيق تمبلت ظهور ومظهر اللوجو المختار بدقة هندسية وجمالية فائقة
    const appTemplate = state.appearanceTemplate || 'neon';
    
    if (appTemplate === 'neon') {
      // نيون تيك توك: توهج سيان ووردي مشع وعالي الجاذبية
      ctx.shadowColor = wm.isMoving ? '#fe2c55' : '#25f4ee';
      ctx.shadowBlur = Math.round(logoWidth * 0.18);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else if (appTemplate === 'cinematic') {
      // تنفس سينمائي: ظل داكن ناعم وعميق
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = Math.round(logoWidth * 0.14);
      ctx.shadowOffsetX = Math.round(logoWidth * 0.02);
      ctx.shadowOffsetY = Math.round(logoWidth * 0.03);
    } else if (appTemplate === 'shield') {
      // درع حماية: ظل أسود حاد ومكثف 100% لمنع ضياع اللوجو في الخلفيات الساطعة أو المعقدة
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = Math.round(logoWidth * 0.08);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else if (appTemplate === 'glass') {
      // كريستال نقي: لمعان زجاجي فخم وشفاف
      ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
      ctx.shadowBlur = Math.round(logoWidth * 0.05);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else if (appTemplate === 'flash') {
      // وميض خاطف: توهج خاطف أبيض/سيان مشع
      const flashCycle = (timeInSeconds * 1.5) % 2.5;
      if (flashCycle < 0.35) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = Math.round(logoWidth * 0.28);
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = Math.round(logoWidth * 0.10);
      }
    } else if (appTemplate === 'water') {
      // طفو مائي: توهج مائي أزرق سماوي ناعم
      ctx.shadowColor = 'rgba(37, 244, 238, 0.35)';
      ctx.shadowBlur = Math.round(logoWidth * 0.16);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.round(logoWidth * 0.02);
    }
    
    ctx.drawImage(
      state.logoImg,
      -logoWidth / 2,
      -logoHeight / 2,
      logoWidth,
      logoHeight
    );
    ctx.restore();
    
    // 5. تحديث مؤشرات التتبع الحية على نافذة المعاينة
    if (!state.isExporting) {
      updateTelemetryBar(wm);
    }
  }
}

function renderFrame() {
  const video = state.sourceVideo;
  
  if (state.isVideoReady && video.readyState >= 2) {
    // أثناء التصدير، تتولى دالة المزامنة وحدها الرسم بدقة مطلقة لمنع سقوط الفريمات والتجميد
    if (!state.isExporting) {
      let currentTime = video.currentTime;
      if (!state.isPlaying) {
        // استمرار الحركة بالحساب الزمني أثناء توقف الفيديو في المعاينة
        const now = performance.now() / 1000;
        currentTime = state.pausedVirtualTimeOffset + now;
      }
      
      drawCanvasFrame(currentTime);
      updateTimelineProgress();
    }
  }
  
  requestAnimationFrame(renderFrame);
}

function updateTimelineProgress() {
  const video = state.sourceVideo;
  if (!video || !video.duration) return;
  
  const slider = document.getElementById('timelineSlider');
  const timeDisplay = document.getElementById('timeDisplay');
  
  const percent = (video.currentTime / video.duration) * 100;
  slider.value = percent || 0;
  timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ============================================================================
// 10. إعداد وتكوين الصوت الصامت عبر Web Audio API أثناء التصدير
// ============================================================================
function setupAudioGraph() {
  if (state.audioCtx) return;
  
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    const actx = new AudioContextClass();
    const source = actx.createMediaElementSource(state.sourceVideo);
    const dest = actx.createMediaStreamDestination();
    const speakerGain = actx.createGain();
    
    source.connect(dest);         // متصل بمجرى التسجيل دائماً
    source.connect(speakerGain);   // متصل بالسماعات
    speakerGain.connect(actx.destination);
    
    // همس غير مسموع إطلاقاً (-80dB) يمنع نوم ساعة الصوت في المتصفح وتجمد الفيديو
    speakerGain.gain.value = 0.0001;
    
    state.audioCtx = actx;
    state.audioSourceNode = source;
    state.audioDestNode = dest;
    state.audioSpeakerGain = speakerGain;
  } catch (err) {
    console.warn('AudioContext setup skipped or already attached:', err);
  }
}

// ============================================================================
// 11. عملية التصدير والتسجيل الصامت (Full Export Workflow)
// ============================================================================
async function startVideoExport() {
  const video = state.sourceVideo;
  const canvas = state.canvas;
  const ctx = state.ctx;
  
  if (!state.isVideoReady || !video.duration) {
    showToast('يرجى اختيار فيديو أولاً قبل التصدير', 'error');
    return;
  }
  
  // 1. فحص أمان أصل الكانفس (Origin-Clean Check) لمنع خطأ SecurityError على بروتوكول file://
  if (!isCanvasOriginClean(state.canvas)) {
    state.pendingExportAfterLogoPick = true;
    showSecurityTaintModal();
    return;
  }
  
  // تجهيز مسارات الصوت
  setupAudioGraph();
  if (state.audioCtx && state.audioCtx.state === 'suspended') {
    await state.audioCtx.resume();
  }
  
  // كتم الصوت الخارجي لتسجيل صامت مريح مع الحفاظ على ساعة الصوت نشطة
  if (state.audioSpeakerGain) {
    state.audioSpeakerGain.gain.value = 0.0001;
  }
  
  // تفعيل وضع التصدير وتعطيل أزرار الواجهة
  state.isExporting = true;
  toggleInputsDisabled(true);
  
  // إظهار كارت شريط التقدم الضخم
  const exportCard = document.getElementById('exportProgressCard');
  const resultCard = document.getElementById('resultCard');
  exportCard.classList.add('active');
  resultCard.classList.remove('active');
  
  // إعادة بناء المسار الزمني بنفس البذرة الثابتة تماماً
  generateWaypointsTimeline();
  
  // تجهيز مجرى الكانفس بمطابقة تامة مع معدل إطارات المصدر (Match Source) مع حماية أمان كاملة
  const targetFps = state.videoFps || 30;
  let canvasStream;
  try {
    canvasStream = canvas.captureStream(targetFps);
  } catch (err) {
    state.isExporting = false;
    toggleInputsDisabled(false);
    exportCard.classList.remove('active');
    
    if (err.name === 'SecurityError' || (err.message && err.message.includes('origin-clean'))) {
      state.pendingExportAfterLogoPick = true;
      showSecurityTaintModal();
    } else {
      showToast(`فشل بدء التقاط الفيديو: ${err.message}`, 'error');
    }
    return;
  }
  
  let finalStream = canvasStream;
  
  const exportFpsText = document.getElementById('exportFpsText');
  if (exportFpsText) {
    exportFpsText.textContent = `معدل الإطارات: ${targetFps} FPS (مطابق للمصدر 100%)`;
  }
  
  // ربط الصوت الصامت النظيف من AudioContext بدون تعارضات
  if (state.audioDestNode && state.audioDestNode.stream) {
    const audioTracks = state.audioDestNode.stream.getAudioTracks();
    if (audioTracks.length > 0) {
      finalStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks
      ]);
    }
  }
  
  // تجهيز MediaRecorder مع جودة بصرية فائقة ومثالية لتفادي أي سقوط فريمات
  state.recordedChunks = [];
  const selectedMime = detectBestSupportedMimeType();
  state.bestMimeType = selectedMime;
  
  // معدل بت متوازن يمنع امتلاء ذاكرة التخزين المؤقت للمشفر ويمنع التوقف نهائياً
  let optimalBitrate = 5500000; // 5.5 Mbps لـ 1080p
  if (canvas.width * canvas.height > 1920 * 1080) {
    optimalBitrate = 12000000; // 12 Mbps لـ 4K
  } else if (canvas.width * canvas.height <= 1280 * 720) {
    optimalBitrate = 3200000;  // 3.2 Mbps لـ 720p
  }
  
  let recorder;
  try {
    recorder = new MediaRecorder(finalStream, {
      mimeType: selectedMime,
      videoBitsPerSecond: optimalBitrate
    });
  } catch (err) {
    try {
      recorder = new MediaRecorder(finalStream);
    } catch (e2) {
      showToast(`فشل بدء مسجل الوسائط: ${e2.message}`, 'error');
      finishExport(false);
      return;
    }
  }
  
  state.mediaRecorder = recorder;
  
  // طلب منع إغلاق الشاشة أو تجميد المعالج أثناء التصدير
  try {
    if ('wakeLock' in navigator && navigator.wakeLock) {
      state.wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) {}
  
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      state.recordedChunks.push(event.data);
    }
  };
  
  recorder.onstop = () => {
    const finalBlob = new Blob(state.recordedChunks, { type: state.bestMimeType });
    state.exportedBlob = finalBlob;
    finishExport(true);
  };
  
  // حلقة رسم انسيابية موحدة لا تنقطع طوال فترة التصدير مع معزز فريمات كرت الشاشة
  let exportAnimFrameId = null;
  const exportLoop = () => {
    if (!state.isExporting || video.ended) return;
    drawCanvasFrame(video.currentTime);
    exportAnimFrameId = requestAnimationFrame(exportLoop);
  };
  
  const onVideoFrameCallback = (now, metadata) => {
    if (!state.isExporting || video.ended) return;
    drawCanvasFrame(metadata.mediaTime);
    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(onVideoFrameCallback);
    }
  };
  
  let isEndedHandled = false;
  let progressTimer = null;
  
  const onEnded = () => {
    if (isEndedHandled) return;
    isEndedHandled = true;
    
    video.removeEventListener('ended', onEnded);
    if (progressTimer) clearInterval(progressTimer);
    if (exportAnimFrameId) {
      cancelAnimationFrame(exportAnimFrameId);
      exportAnimFrameId = null;
    }
    
    // رسم الفريم الأخير الكامل حتى نهاية الفيديو بدقة
    drawCanvasFrame(video.duration || video.currentTime);
    
    document.getElementById('exportStatusText').textContent = 'جاري إنهاء وتفريغ الملف بجودة مطابقة للمصدر 100%...';
    
    setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, 60);
  };
  
  const startRecordingFlow = () => {
    // رسم الفريم الأول عند الزمن 0
    drawCanvasFrame(0);
    
    // تشغيل الفيديو ثم بدء المسجل فوراً بمجرد تأكيد انطلاق المشغل
    video.play().then(() => {
      state.exportStartTime = performance.now();
      
      try {
        recorder.start(1000); // تفريغ القطع بانتظام كل 1 ثانية
      } catch (recErr) {
        showToast(`فشل بدء مسجل الوسائط: ${recErr.message}`, 'error');
        finishExport(false);
        return;
      }
      
      // انطلاق حلقة الرسم المستمرة مع دوران الفيديو
      exportAnimFrameId = requestAnimationFrame(exportLoop);
      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(onVideoFrameCallback);
      }
    }).catch((err) => {
      showToast(`تعذر تشغيل الفيديو: ${err.message}`, 'error');
      finishExport(false);
      return;
    });
    
    // متابعة التقدم كل 250ms
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      if (!state.isExporting) {
        clearInterval(progressTimer);
        return;
      }
      
      const current = video.currentTime;
      const duration = video.duration || 1;
      const percent = Math.min(100, Math.max(0, (current / duration) * 100));
      
      // تفقد الوصول لنهاية الفيديو فقط عند اكتمال مدة الفيديو الحقيقية كاملة
      if (video.ended || (current >= duration - 0.02 && duration > 0.5)) {
        onEnded();
        return;
      }
      
      // حساب الحجم الكلي المسجل
      let totalBytes = 0;
      for (const ch of state.recordedChunks) {
        totalBytes += ch.size;
      }
      const mb = (totalBytes / (1024 * 1024)).toFixed(1);
      
      // حساب الوقت التقريبي المتبقي (ETA)
      const elapsed = (performance.now() - state.exportStartTime) / 1000;
      let etaText = 'حساب...';
      if (percent > 2 && percent < 100) {
        const totalEstimatedTime = elapsed / (percent / 100);
        const remaining = Math.max(0, totalEstimatedTime - elapsed);
        etaText = `المتبقي: ${Math.ceil(remaining)} ثانية`;
      } else if (percent >= 100) {
        etaText = 'جاري إنهاء الملف...';
      }
      
      document.getElementById('exportPercentText').textContent = `${Math.round(percent)}%`;
      document.getElementById('exportProgressBar').style.width = `${percent}%`;
      document.getElementById('exportSizeText').textContent = `${mb} MB`;
      document.getElementById('exportEtaText').textContent = etaText;
    }, CONFIG.export.progressIntervalMs);
  };
  
  video.addEventListener('ended', onEnded);
  video.pause();
  
  // معالجة الانتقال إلى بداية الفيديو بأمان
  let seekStarted = false;
  const onSeekedReady = () => {
    if (seekStarted) return;
    seekStarted = true;
    video.removeEventListener('seeked', onSeekedReady);
    startRecordingFlow();
  };
  
  if (Math.abs(video.currentTime) < 0.05) {
    onSeekedReady();
  } else {
    video.addEventListener('seeked', onSeekedReady, { once: true });
    video.currentTime = 0;
    setTimeout(onSeekedReady, 350);
  }
}

/**
 * إنهاء التصدير وتحديث الواجهة
 */
function finishExport(isSuccess) {
  state.isExporting = false;
  toggleInputsDisabled(false);
  
  // تحرير قفل إبقاء الشاشة نشطة
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
  }
  
  // إعادة الصوت للسماعات
  if (state.audioSpeakerGain) {
    state.audioSpeakerGain.gain.value = 1.0;
  }
  
  const exportCard = document.getElementById('exportProgressCard');
  exportCard.classList.remove('active');
  
  if (isSuccess && state.exportedBlob) {
    const resultCard = document.getElementById('resultCard');
    const resultVideo = document.getElementById('resultVideo');
    const blobUrl = URL.createObjectURL(state.exportedBlob);
    
    resultVideo.src = blobUrl;
    resultCard.classList.add('active');
    
    // تمرير الشاشة للنتيجة بسلاسة
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    showToast('تم تصدير الفيديو بنجاح! اضغط على زر الحفظ لتنزيله مباشرة.', 'success', 6000);
    
    // تنزيل تلقائي فوري للملف كما طُلِب في المواصفات
    triggerDirectDownload();
  }
}

/**
 * حفظ وتنزيل الفيديو مباشرة عبر زر التنزيل أو a.download (ممنوع picker نهائياً)
 */
function triggerDirectDownload() {
  if (!state.exportedBlob) {
    showToast('لا يوجد فيديو مُصدّر للحفظ', 'error');
    return;
  }
  
  const ext = state.bestMimeType.includes('mp4') ? 'mp4' : 'webm';
  const cleanName = (state.originalVideoName || 'video').trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
  const filename = `${cleanName}_watermark.${ext}`;
  
  const url = URL.createObjectURL(state.exportedBlob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = filename;
  
  document.body.appendChild(anchor);
  anchor.click();
  
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 2000);
  
  showToast(`تم بدء تنزيل الملف: ${filename}`, 'success');
}

/**
 * تعطيل/تفعيل عناصر التحكم أثناء التصدير
 */
function toggleInputsDisabled(disabled) {
  const elements = [
    'videoFileInput', 'chooseVideoBtn', 'loadDemoBtn',
    'logoFileInput', 'chooseLogoBtn',
    'sizeSlider', 'transitSpeedSlider', 'pulseSpeedSlider', 'maxOpacitySlider',
    'resetSettingsBtn', 'openExportModalBtn', 'playPauseBtn', 'timelineSlider'
  ];
  
  elements.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

// ============================================================================
// 12. نظام التنبيهات (Toast Notifications)
// ============================================================================
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  } else {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25f4ee" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }
  
  toast.innerHTML = `
    <div style="flex-shrink:0;">${iconSvg}</div>
    <div style="flex:1;">${message}</div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================================================
// 13. التحكم في تشغيل الفيديو
// ============================================================================
function togglePlayPause() {
  const video = state.sourceVideo;
  if (!state.isVideoReady) return;
  
  if (video.paused) {
    video.play().then(() => {
      state.isPlaying = true;
      updatePlayPauseButton();
    }).catch((e) => {
      console.warn(e);
    });
  } else {
    video.pause();
    state.isPlaying = false;
    state.pausedVirtualTimeOffset = video.currentTime - (performance.now() / 1000);
    updatePlayPauseButton();
  }
}

function updatePlayPauseButton() {
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  
  if (state.isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
}

// ============================================================================
// 14. ربط الأحداث وعناصر الواجهة (Event Listeners & Initialization)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  state.sourceVideo = document.getElementById('sourceVideo');
  state.canvas = document.getElementById('previewCanvas');
  state.ctx = state.canvas.getContext('2d', { willReadFrequently: true });
  // فحص صيغ التسجيل وتحديث الشارة
  updateMimeChip();
  
  // تحميل اللوجو الافتراضي
  loadDefaultLogo();
  
  // بناء المسار الزمني الأولي
  generateWaypointsTimeline();
  
  // بدء حلقة الرسم
  requestAnimationFrame(renderFrame);
  
  // -------------------------------------------------------------
  // أحداث الفيديو
  // -------------------------------------------------------------
  const videoInput = document.getElementById('videoFileInput');
  const chooseVideoBtn = document.getElementById('chooseVideoBtn');
  const videoDropzone = document.getElementById('videoDropzone');
  const loadDemoBtn = document.getElementById('loadDemoBtn');
  
  chooseVideoBtn.addEventListener('click', () => videoInput.click());
  videoDropzone.addEventListener('click', (e) => {
    if (e.target !== chooseVideoBtn) videoInput.click();
  });
  
  videoInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUserVideoFile(e.target.files[0]);
    }
  });
  
  loadDemoBtn.addEventListener('click', () => {
    loadDemoVideoClip();
  });
  
  // السحب والإفلات للفيديو
  ['dragenter', 'dragover'].forEach((eventName) => {
    videoDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      videoDropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    videoDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      videoDropzone.classList.remove('dragover');
    });
  });
  videoDropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUserVideoFile(e.dataTransfer.files[0]);
    }
  });
  
  // -------------------------------------------------------------
  // أحداث اللوجو
  // -------------------------------------------------------------
  const logoInput = document.getElementById('logoFileInput');
  const chooseLogoBtn = document.getElementById('chooseLogoBtn');
  const logoDropzone = document.getElementById('logoDropzone');
  
  chooseLogoBtn.addEventListener('click', () => logoInput.click());
  logoDropzone.addEventListener('click', (e) => {
    if (e.target !== chooseLogoBtn) logoInput.click();
  });
  
  logoInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUserLogoFile(e.target.files[0]);
    }
  });
  
  ['dragenter', 'dragover'].forEach((eventName) => {
    logoDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      logoDropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    logoDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      logoDropzone.classList.remove('dragover');
    });
  });
  logoDropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUserLogoFile(e.dataTransfer.files[0]);
    }
  });
  
  // زر تحديث وقراءة assets/logo.png من المجلد
  const reloadAssetsLogoBtn = document.getElementById('reloadAssetsLogoBtn');
  if (reloadAssetsLogoBtn) {
    reloadAssetsLogoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadDefaultLogo(true);
    });
  }

  // زر استعادة لوجو PNG الافتراضي
  const resetDefaultLogoBtn = document.getElementById('resetDefaultLogoBtn');
  if (resetDefaultLogoBtn) {
    resetDefaultLogoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadDefaultLogo(true);
      showToast('تمت استعادة لوجو assets/logo.png الافتراضي ✅', 'success');
    });
  }
  
  // -------------------------------------------------------------
  // أحداث السلايدرات والاستوديو الإبداعي
  // -------------------------------------------------------------
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValText = document.getElementById('sizeValText');
  if (sizeSlider) {
    sizeSlider.addEventListener('input', (e) => {
      state.logoSizePercent = parseInt(e.target.value, 10);
      if (sizeValText) sizeValText.textContent = `${state.logoSizePercent}%`;
      if (state.canvas && state.ctx) {
        drawCanvasFrame(state.sourceVideo ? state.sourceVideo.currentTime : 0);
      }
    });
  }
  
  const transitSpeedSlider = document.getElementById('transitSpeedSlider');
  const transitSpeedValText = document.getElementById('transitSpeedValText');
  if (transitSpeedSlider) {
    transitSpeedSlider.addEventListener('input', (e) => {
      state.transitSpeedMultiplier = parseFloat(e.target.value);
      if (transitSpeedValText) transitSpeedValText.textContent = `×${state.transitSpeedMultiplier.toFixed(1)}`;
      generateWaypointsTimeline();
    });
  }
  
  const pulseSpeedSlider = document.getElementById('pulseSpeedSlider');
  const pulseSpeedValText = document.getElementById('pulseSpeedValText');
  if (pulseSpeedSlider) {
    pulseSpeedSlider.addEventListener('input', (e) => {
      state.pulseSpeedMultiplier = parseFloat(e.target.value);
      if (pulseSpeedValText) pulseSpeedValText.textContent = `×${state.pulseSpeedMultiplier.toFixed(1)}`;
    });
  }
  
  const maxOpacitySlider = document.getElementById('maxOpacitySlider');
  const maxOpacityValText = document.getElementById('maxOpacityValText');
  if (maxOpacitySlider) {
    maxOpacitySlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.maxPulseAlpha = val / 100;
      if (maxOpacityValText) maxOpacityValText.textContent = `${val}%`;
    });
  }
  
  const glowSlider = document.getElementById('glowSlider');
  const glowValText = document.getElementById('glowValText');
  if (glowSlider) {
    glowSlider.addEventListener('input', (e) => {
      state.glowIntensity = parseInt(e.target.value, 10);
      if (glowValText) glowValText.textContent = `${state.glowIntensity}%`;
    });
  }
  
  const tiltSlider = document.getElementById('tiltSlider');
  const tiltValText = document.getElementById('tiltValText');
  if (tiltSlider) {
    tiltSlider.addEventListener('input', (e) => {
      state.tiltMaxAngle = parseInt(e.target.value, 10);
      if (tiltValText) tiltValText.textContent = state.tiltMaxAngle === 0 ? 'معطل' : `${state.tiltMaxAngle}°`;
      generateWaypointsTimeline();
    });
  }
  
  // 1. اختيار تمبلتس مسار الحركة الإبداعي (6 Motion Templates)
  const motionCards = document.querySelectorAll('.motion-card');
  motionCards.forEach((card) => {
    card.addEventListener('click', () => {
      state.movementPath = card.dataset.path;
      motionCards.forEach((c) => c.classList.toggle('active', c === card));
      
      // ضبط المعايير الفيزيائية المتناسقة مع طبيعة الحركة
      if (state.movementPath === 'glide') {
        state.easingType = 'quintic';
        state.tiltMaxAngle = 6;
      } else if (state.movementPath === 'bounce') {
        state.easingType = 'spring';
        state.tiltMaxAngle = 10;
      } else if (state.movementPath === 'orbit') {
        state.easingType = 'quintic';
        state.tiltMaxAngle = 8;
      } else if (state.movementPath === 'wave') {
        state.easingType = 'smooth';
        state.tiltMaxAngle = 5;
      } else if (state.movementPath === 'stealth') {
        state.easingType = 'cubic';
        state.tiltMaxAngle = 0;
      } else {
        state.easingType = 'cubic';
        state.tiltMaxAngle = 8;
      }
      
      const motionNames = {
        random: 'تيك توك كلاسيك 🎵',
        glide: 'انزلاق سينمائي 🚀',
        bounce: 'ارتداد زنبركي ⚡',
        orbit: 'مدار لانهائي ♾️',
        wave: 'أمواج عائمة 🌊',
        stealth: 'شبح الحماية 👻'
      };
      showToast(`تم تفعيل تمبلت الحركة: ${motionNames[state.movementPath] || state.movementPath}`, 'info', 1800);
      
      generateWaypointsTimeline();
      if (state.canvas && state.ctx) {
        drawCanvasFrame(state.sourceVideo ? state.sourceVideo.currentTime : 0);
      }
    });
  });

  // 2. اختيار تمبلتس ظهور ومظهر اللوجو (6 Logo Appearance Templates)
  const appearanceCards = document.querySelectorAll('.appearance-card');
  appearanceCards.forEach((card) => {
    card.addEventListener('click', () => {
      state.appearanceTemplate = card.dataset.appearance;
      appearanceCards.forEach((c) => c.classList.toggle('active', c === card));
      
      const appNames = {
        neon: 'نيون تيك توك ✨',
        cinematic: 'تنفس سينمائي 🎬',
        shield: 'درع حماية 🛡️',
        glass: 'كريستال نقي 💎',
        flash: 'وميض خاطف ⚡',
        water: 'طفو مائي 💧'
      };
      showToast(`تم تفعيل تمبلت المظهر: ${appNames[state.appearanceTemplate] || state.appearanceTemplate}`, 'info', 1800);
      
      if (state.canvas && state.ctx) {
        drawCanvasFrame(state.sourceVideo ? state.sourceVideo.currentTime : 0);
      }
    });
  });

  // اختيار منحنى التسارع الفيزيائي (4 Easing Curves) إن وُجد
  const easingBtns = document.querySelectorAll('.easing-btn');
  const easingValText = document.getElementById('easingValText');
  const easingLabels = {
    quintic: 'فائق النعومة (Quintic)',
    spring: 'ارتدادي مرن (Spring)',
    cubic: 'انسيابي تيك توك (Cubic)',
    smooth: 'هادئ ناعم (Hermite)'
  };
  easingBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.easingType = btn.dataset.easing;
      easingBtns.forEach((b) => b.classList.toggle('active', b === btn));
      if (easingValText) {
        easingValText.textContent = easingLabels[state.easingType] || state.easingType;
      }
      generateWaypointsTimeline();
    });
  });

  // مفتاح التنفس والطفو الحي (Living Micro-Breathing)
  const microBreathingToggle = document.getElementById('microBreathingToggle');
  if (microBreathingToggle) {
    microBreathingToggle.addEventListener('change', (e) => {
      state.microBreathing = e.target.checked;
    });
  }

  // زر إظهار / إخفاء خطوط مسار الحركة على الكانفس
  const togglePathPreviewBtn = document.getElementById('togglePathPreviewBtn');
  const pathPreviewStateText = document.getElementById('pathPreviewStateText');
  if (togglePathPreviewBtn) {
    togglePathPreviewBtn.addEventListener('click', () => {
      state.showPathPreview = !state.showPathPreview;
      togglePathPreviewBtn.classList.toggle('active', state.showPathPreview);
      if (pathPreviewStateText) {
        pathPreviewStateText.textContent = state.showPathPreview ? 'معروض ✅' : 'مخفي';
      }
      if (state.canvas && state.ctx) {
        drawCanvasFrame(state.sourceVideo ? state.sourceVideo.currentTime : 0);
      }
    });
  }

  // زر إعادة الفيديو للبداية (0:00)
  const restartVideoBtn = document.getElementById('restartVideoBtn');
  if (restartVideoBtn) {
    restartVideoBtn.addEventListener('click', () => {
      if (!state.isVideoReady) return;
      state.sourceVideo.currentTime = 0;
      state.pausedVirtualTimeOffset = 0;
      updateTimelineProgress();
      if (state.canvas && state.ctx) {
        drawCanvasFrame(0);
      }
    });
  }
  
  // زر استعادة الإعدادات الافتراضية
  const resetSettingsBtn = document.getElementById('resetSettingsBtn');
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', () => {
      state.movementPath = 'random';
      state.appearanceTemplate = 'neon';
      state.logoSizePercent = 20;
      if (sizeSlider) sizeSlider.value = 20;
      if (sizeValText) sizeValText.textContent = '20%';
      motionCards.forEach((c) => c.classList.toggle('active', c.dataset.path === 'random'));
      appearanceCards.forEach((c) => c.classList.toggle('active', c.dataset.appearance === 'neon'));
      generateWaypointsTimeline();
      showToast('تمت استعادة إعدادات تيك توك الافتراضية', 'info');
    });
  }
  
  // -------------------------------------------------------------
  // مشغل الفيديو والتحكم
  // -------------------------------------------------------------
  document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
  
  const timelineSlider = document.getElementById('timelineSlider');
  timelineSlider.addEventListener('input', (e) => {
    if (!state.isVideoReady) return;
    const video = state.sourceVideo;
    const seekTime = (parseFloat(e.target.value) / 100) * video.duration;
    video.currentTime = seekTime;
  });
  
  // استكمال تلقائي لو أوقف المتصفح الفيديو أثناء التصدير (كما هو مطلوب بالشرط التقني)
  state.sourceVideo.addEventListener('pause', () => {
    if (state.isExporting && !state.sourceVideo.ended) {
      state.sourceVideo.play().catch(() => {});
    }
  });
  
  state.sourceVideo.addEventListener('play', () => {
    if (!state.isExporting) {
      state.isPlaying = true;
      updatePlayPauseButton();
    }
  });
  
  state.sourceVideo.addEventListener('pause', () => {
    if (!state.isExporting) {
      state.isPlaying = false;
      updatePlayPauseButton();
    }
  });
  
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // تصدير الفيديو مباشرة وفوراً عند الضغط دون أي نوافذ تأكيد
  // -------------------------------------------------------------
  const openExportBtn = document.getElementById('openExportModalBtn');
  
  openExportBtn.addEventListener('click', () => {
    if (!state.isVideoReady) return;
    
    // بدء التصدير فوراً دون إظهار أي نافذة منبثقة
    startVideoExport();
  });
  
  // أزرار نافذة إذن أمان المتصفح (file:// protocol security modal)
  const modalPickLogoBtn = document.getElementById('modalPickLogoBtn');
  if (modalPickLogoBtn) {
    modalPickLogoBtn.addEventListener('click', () => {
      const logoInput = document.getElementById('logoFileInput');
      if (logoInput) logoInput.click();
    });
  }
  
  const modalExportWithoutLogoBtn = document.getElementById('modalExportWithoutLogoBtn');
  if (modalExportWithoutLogoBtn) {
    modalExportWithoutLogoBtn.addEventListener('click', () => {
      hideSecurityTaintModal();
      state.isLogoLoaded = false;
      resetToFreshCanvas();
      startVideoExport();
    });
  }
  
  const modalCloseSecurityBtn = document.getElementById('modalCloseSecurityBtn');
  if (modalCloseSecurityBtn) {
    modalCloseSecurityBtn.addEventListener('click', () => {
      hideSecurityTaintModal();
      state.pendingExportAfterLogoPick = false;
    });
  }

  // زر تحميل النتيجة النهائية
  document.getElementById('downloadFinalBtn').addEventListener('click', () => {
    triggerDirectDownload();
  });
  
  // حماية من إغلاق التبويب أثناء التصدير
  window.addEventListener('beforeunload', (e) => {
    if (state.isExporting) {
      e.preventDefault();
      e.returnValue = 'جاري تصدير الفيديو حالياً، هل أنت متأكد من رغبتك في المغادرة؟';
    }
  });
});
