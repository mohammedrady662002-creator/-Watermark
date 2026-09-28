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

// دالة التخفيف التكعيبي للانتقال السلس (easeInOutCubic)
function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
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
  exportStartTime: 0
};

// ============================================================================
// 4. توليد المسار الزمني الثابت للعلامة المائية (Deterministic Timeline)
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
  
  while (curTime < maxTime) {
    // حساب المدة بين الانتقالات (Dwell duration)
    const rawInterval = CONFIG.watermark.minInterval + rng() * (CONFIG.watermark.maxInterval - CONFIG.watermark.minInterval);
    const dwellDuration = rawInterval / state.transitSpeedMultiplier;
    const dwellEnd = curTime + dwellDuration;
    
    // حساب مدة حركة الانتقال (Transit duration)
    const transitDuration = CONFIG.watermark.minTransitDuration + rng() * (CONFIG.watermark.maxTransitDuration - CONFIG.watermark.minTransitDuration);
    const transitEnd = dwellEnd + transitDuration;
    
    // موقع عشوائي جديد داخل النطاق الآمن (0 إلى 1 كنِسَب مئوية)
    const nextX = rng();
    const nextY = rng();
    
    // زاوية دوران عشوائية بين -15 و +15 درجة
    const nextRot = (CONFIG.watermark.rotationMinDeg + rng() * (CONFIG.watermark.rotationMaxDeg - CONFIG.watermark.rotationMinDeg)) * (Math.PI / 180);
    
    // مقياس حجم عشوائي بين 0.90 و 1.15
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
 * حساب حالة العلامة المائية عند أي ثانية t بدقة مطلقة
 */
function getWatermarkStateAtTime(t) {
  if (state.waypoints.length === 0) {
    generateWaypointsTimeline();
  }
  
  const safeT = Math.max(0, t);
  let low = 0;
  let high = state.waypoints.length - 1;
  let seg = state.waypoints[0];
  
  // بحث ثنائي سريع لإيجاد الشريحة الزمنية المناسبة
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
  
  if (safeT >= seg.dwellEnd && safeT < seg.transitEnd && seg.transitDuration > 0) {
    const rawProgress = (safeT - seg.dwellEnd) / seg.transitDuration;
    const eased = easeInOutCubic(Math.min(1, Math.max(0, rawProgress)));
    xRatio = seg.startX + (seg.targetX - seg.startX) * eased;
    yRatio = seg.startY + (seg.targetY - seg.startY) * eased;
    rot = seg.startRot + (seg.targetRot - seg.startRot) * eased;
    scale = seg.startScale + (seg.targetScale - seg.startScale) * eased;
  } else if (safeT >= seg.transitEnd) {
    xRatio = seg.targetX;
    yRatio = seg.targetY;
    rot = seg.targetRot;
    scale = seg.targetScale;
  }
  
  // حساب نبض الشفافية الجيبي المستمر
  const pulseFreq = (2 * Math.PI) / (CONFIG.watermark.pulsePeriodSeconds / state.pulseSpeedMultiplier);
  const sineFactor = (Math.sin(safeT * pulseFreq) + 1) / 2; // بين 0 و 1
  const alpha = CONFIG.watermark.minPulseAlpha + sineFactor * (state.maxPulseAlpha - CONFIG.watermark.minPulseAlpha);
  
  return { xRatio, yRatio, rot, scale, alpha };
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
// 6. قسم الأمان وفحص تلوين الكانفس (file:// and Taint Security)
// ============================================================================
function checkFileProtocolSecurity() {
  const alertEl = document.getElementById('fileProtocolAlert');
  if (window.location.protocol === 'file:') {
    alertEl.classList.add('show');
    showToast('تنبيه: أنت تعمل عبر file://. يرجى اختيار اللوجو يدويًا أو تشغيل start.bat', 'info', 6000);
  } else {
    alertEl.classList.remove('show');
  }
}

/**
 * فحص هل الكانفس آمن وغير ملوث قبل بدء التصدير
 */
function isCanvasOriginClean(context) {
  try {
    context.getImageData(0, 0, 1, 1);
    return true;
  } catch (err) {
    return false;
  }
}

// ============================================================================
// 7. إدارة ملفات اللوجو والفيديو
// ============================================================================

/**
 * تحميل اللوجو الافتراضي بأمان عبر HTTP
 */
function loadDefaultLogo() {
  const logoThumb = document.getElementById('logoThumbnailImg');
  const logoStatusBadge = document.getElementById('logoStatusBadge');
  const logoFileName = document.getElementById('logoFileName');
  const logoDimensions = document.getElementById('logoDimensions');
  
  if (window.location.protocol === 'file:') {
    logoStatusBadge.textContent = 'بانتظار اختيارك';
    logoStatusBadge.style.color = '#fbbf24';
    return;
  }
  
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    state.logoImg = img;
    state.isLogoLoaded = true;
    logoThumb.src = img.src;
    logoStatusBadge.textContent = 'تم تحميل الافتراضي';
    logoStatusBadge.style.color = '#34d399';
    logoFileName.textContent = 'assets/logo.png (الافتراضي)';
    logoDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight} بكسل`;
    document.getElementById('logoDropzone').classList.add('filled');
  };
  img.onerror = () => {
    // لو لم يتم العثور على assets/logo.png ننشئ لوجو ناعم ديناميكي
    generateFallbackLogoDataUrl();
  };
  img.src = CONFIG.watermark.defaultPath;
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
    document.getElementById('logoThumbnailImg').src = dataUrl;
    document.getElementById('logoStatusBadge').textContent = 'لوجو إيلين الافتراضي ✅';
    document.getElementById('logoStatusBadge').style.color = '#34d399';
    document.getElementById('logoFileName').textContent = 'دكان إيلين (افتراضي جاهز)';
    document.getElementById('logoDimensions').textContent = '512 × 512 بكسل (عالي الدقة)';
    document.getElementById('logoDropzone').classList.add('filled');
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
      
      showToast(`تم تعيين اللوجو: ${file.name} بنجاح`, 'success');
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
    
    videoDropzone.classList.add('filled');
    videoInfoPill.classList.add('show');
    videoNameText.textContent = file.name;
    videoDimText.textContent = `${video.videoWidth} × ${video.videoHeight}`;
    videoDurationText.textContent = formatTime(video.duration);
    openExportBtn.removeAttribute('disabled');
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
    dCtx.fillText('فيديو تجريبي - علامة مائية متحركة', 540, 510);
    
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
 * كشف وقياس معدل إطارات الفيديو (FPS) الأصلي لمطابقته بدقة عند التصدير
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
        
        const exportFpsText = document.getElementById('exportFpsText');
        if (exportFpsText) {
          exportFpsText.textContent = `معدل الإطارات: ${state.videoFps} FPS (مطابق للمصدر)`;
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
    
    ctx.save();
    ctx.translate(posX, posY);
    ctx.rotate(wm.rot);
    ctx.globalAlpha = Math.min(1, Math.max(0.05, wm.alpha));
    ctx.drawImage(
      state.logoImg,
      -logoWidth / 2,
      -logoHeight / 2,
      logoWidth,
      logoHeight
    );
    ctx.restore();
  }
}

function renderFrame() {
  const video = state.sourceVideo;
  
  if (state.isVideoReady && video.readyState >= 2) {
    let currentTime = video.currentTime;
    if (!state.isPlaying && !state.isExporting) {
      // استمرار الحركة بالحساب الزمني حتى لو الفيديو متوقف
      const now = performance.now() / 1000;
      currentTime = state.pausedVirtualTimeOffset + now;
    }
    
    drawCanvasFrame(currentTime);
    
    // تحديث مؤشر الوقت وشريط التشغيل إذا لم يكن التصدير جارياً
    if (!state.isExporting) {
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
    
    speakerGain.gain.value = 1.0;
    
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
  
  // فحص أمان الكانفس الإجباري
  if (!isCanvasOriginClean(ctx)) {
    showToast('الكانفس ملوّث بسبب قيود الأمان لمتصفح الملفات. افتح البرنامج عبر start.bat وليس بدبل كليك.', 'error', 7000);
    return;
  }
  
  // إغلاق نافذة التأكيد
  document.getElementById('exportConfirmModal').classList.remove('active');
  
  // تجهيز مسارات الصوت
  setupAudioGraph();
  if (state.audioCtx && state.audioCtx.state === 'suspended') {
    await state.audioCtx.resume();
  }
  
  // كتم الصوت الخارجي لتسجيل صامت مريح
  if (state.audioSpeakerGain) {
    state.audioSpeakerGain.gain.value = 0;
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
  
  // تجهيز مجرى الكانفس بنفس عدد الفريمات الأصلية + مجرى الصوت
  const targetFps = state.videoFps || 30;
  const canvasStream = canvas.captureStream(targetFps);
  let finalStream = canvasStream;
  
  const exportFpsText = document.getElementById('exportFpsText');
  if (exportFpsText) {
    exportFpsText.textContent = `معدل الإطارات: ${targetFps} FPS (تطابق تام مع المصدر)`;
  }
  
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
  
  // حساب معدل بت احترافي يضمن دقة كريستالية مطابقة للمصدر ويمنع أي سقوط فريمات أو اختناق للمشفر
  let optimalBitrate = 9500000; // 9.5 Mbps لـ 1080p
  if (canvas.width * canvas.height > 1920 * 1080) {
    optimalBitrate = 18000000; // 18 Mbps لـ 4K
  } else if (targetFps >= 50) {
    optimalBitrate = 13000000; // 13 Mbps لـ 60fps
  } else if (canvas.width * canvas.height <= 1280 * 720) {
    optimalBitrate = 5500000;  // 5.5 Mbps لـ 720p
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
  
  // مزامنة فريمات الفيديو مع مخرجات مفكك التشفير الحقيقية مباشرة
  const syncExportFrames = (now, metadata) => {
    if (!state.isExporting) return;
    drawCanvasFrame(metadata.mediaTime);
    if (!video.ended && !video.paused) {
      video.requestVideoFrameCallback(syncExportFrames);
    }
  };
  
  // إيقاف تشغيل الفيديو والرجوع للثانية 0
  video.pause();
  video.currentTime = 0;
  
  const onSeeked = () => {
    video.removeEventListener('seeked', onSeeked);
    
    // رسم الفريم الأول فوراً عند الزمن 0
    drawCanvasFrame(0);
    
    // مهلة استقرار قصيرة 100ms لضمان استقرار المشفر ومطابقة الفريمات
    setTimeout(() => {
      state.exportStartTime = performance.now();
      recorder.start(1000); // 1000ms لتقليل الضغط على المعالج وتفادي تقطيع الفريمات
      
      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(syncExportFrames);
      }
      
      video.play().catch((err) => {
        showToast(`تعذر تشغيل الفيديو تلقائياً: ${err.message}`, 'error');
        finishExport(false);
      });
    }, 100);
    
    // متابعة التقدم كل 250ms
    const progressTimer = setInterval(() => {
      if (!state.isExporting) {
        clearInterval(progressTimer);
        return;
      }
      
      const current = video.currentTime;
      const duration = video.duration || 1;
      const percent = Math.min(100, Math.max(0, (current / duration) * 100));
      
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
  
  video.addEventListener('seeked', onSeeked);
  
  // عند انتهاء الفيديو أثناء التصدير
  const onEnded = () => {
    video.removeEventListener('ended', onEnded);
    
    document.getElementById('exportStatusText').textContent = 'جاري تفريغ الإطارات الأخيرة وتجهيز الملف...';
    
    // مهلة صغيرة لتفريغ آخر الإطارات المتبقية
    setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, CONFIG.export.endDelayMs);
  };
  
  video.addEventListener('ended', onEnded);
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
  
  // فحص بيئة الأمان
  checkFileProtocolSecurity();
  
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
  
  // -------------------------------------------------------------
  // أحداث السلايدرات والإعدادات
  // -------------------------------------------------------------
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValText = document.getElementById('sizeValText');
  sizeSlider.addEventListener('input', (e) => {
    state.logoSizePercent = parseInt(e.target.value, 10);
    sizeValText.textContent = `${state.logoSizePercent}%`;
  });
  
  const transitSpeedSlider = document.getElementById('transitSpeedSlider');
  const transitSpeedValText = document.getElementById('transitSpeedValText');
  transitSpeedSlider.addEventListener('input', (e) => {
    state.transitSpeedMultiplier = parseFloat(e.target.value);
    transitSpeedValText.textContent = `×${state.transitSpeedMultiplier.toFixed(1)}`;
    generateWaypointsTimeline(); // إعادة بناء الجدول الزمني فورياً
  });
  
  const pulseSpeedSlider = document.getElementById('pulseSpeedSlider');
  const pulseSpeedValText = document.getElementById('pulseSpeedValText');
  pulseSpeedSlider.addEventListener('input', (e) => {
    state.pulseSpeedMultiplier = parseFloat(e.target.value);
    pulseSpeedValText.textContent = `×${state.pulseSpeedMultiplier.toFixed(1)}`;
  });
  
  const maxOpacitySlider = document.getElementById('maxOpacitySlider');
  const maxOpacityValText = document.getElementById('maxOpacityValText');
  maxOpacitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.maxPulseAlpha = val / 100;
    maxOpacityValText.textContent = `${val}%`;
  });
  
  // زر استعادة الإعدادات الافتراضية
  document.getElementById('resetSettingsBtn').addEventListener('click', () => {
    sizeSlider.value = CONFIG.watermark.defaultSizePercent;
    state.logoSizePercent = CONFIG.watermark.defaultSizePercent;
    sizeValText.textContent = `${state.logoSizePercent}%`;
    
    transitSpeedSlider.value = 1.0;
    state.transitSpeedMultiplier = 1.0;
    transitSpeedValText.textContent = '×1.0';
    
    pulseSpeedSlider.value = 1.0;
    state.pulseSpeedMultiplier = 1.0;
    pulseSpeedValText.textContent = '×1.0';
    
    maxOpacitySlider.value = Math.round(CONFIG.watermark.defaultMaxPulseAlpha * 100);
    state.maxPulseAlpha = CONFIG.watermark.defaultMaxPulseAlpha;
    maxOpacityValText.textContent = `${maxOpacitySlider.value}%`;
    
    generateWaypointsTimeline();
    showToast('تمت استعادة الإعدادات الافتراضية', 'info');
  });
  
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
  // نافذة تأكيد التصدير
  // -------------------------------------------------------------
  const modal = document.getElementById('exportConfirmModal');
  const openExportBtn = document.getElementById('openExportModalBtn');
  const cancelExportBtn = document.getElementById('cancelExportModalBtn');
  const confirmStartBtn = document.getElementById('confirmStartExportBtn');
  
  openExportBtn.addEventListener('click', () => {
    if (!state.isVideoReady) return;
    
    document.getElementById('modalVideoName').textContent = `${state.originalVideoName}`;
    document.getElementById('modalVideoDuration').textContent = formatTime(state.sourceVideo.duration);
    document.getElementById('modalVideoDim').textContent = `${state.canvas.width} × ${state.canvas.height} (دقة أصلية 100% @ ${state.videoFps || 30} FPS)`;
    document.getElementById('modalVideoFormat').textContent = state.bestMimeType;
    
    modal.classList.add('active');
  });
  
  cancelExportBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
  
  confirmStartBtn.addEventListener('click', () => {
    startVideoExport();
  });
  
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
