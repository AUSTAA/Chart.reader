// app.js - واجهة بسيطة لتحميل بيانات CSV وعرض شموع (يشترط وجود ملف المكتبة المحلي)
(function () {
  // تأكد من وجود المكتبة
  if (typeof LightweightCharts === 'undefined') {
    alert('لم يتم العثور على مكتبة lightweight-charts محلياً. تأكد من وضع ملف lightweight-charts.standalone.production.js في نفس المجلد.');
    console.error('LightweightCharts not found');
    return;
  }

  // أنشئ الرسم
  const chart = LightweightCharts.createChart(document.getElementById('chart'), {
    layout: { background: { color: '#0f1115' }, textColor: '#dbe1f4' },
    grid: { vertLines:{ color:'#151923'}, horzLines:{ color:'#151923'} },
    rightPriceScale: { borderColor: '#2a2f3a' },
    timeScale: { borderColor: '#2a2f3a' },
    width: document.getElementById('chart').clientWidth,
    height: Math.max(320, window.innerHeight * 0.6),
    autoSize: true,
  });
  const candleSeries = chart.addCandlestickSeries();

  // مساعدة لتحويل الوقت
  function normalizeTime(t) {
    if (t == null) return null;
    t = String(t).trim();
    // صيغة YYYY-MM-DD فقط -> نعيدها كما هي (التاريخ اليومي مدعوم كسلسلة)
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    // إذا كان ISO أو يتضمن 'T' أو وقت، نعيده كأرقام ثواني (LightweightCharts يقبل number seconds)
    const d = new Date(t);
    if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);
    // إذا كان رقم (ثواني أو ms)
    if (!isNaN(Number(t))) {
      const n = Number(t);
      // إن كان ms (أكبر من 1e12) حوله لثواني
      return n > 1e12 ? Math.floor(n / 1000) : n;
    }
    return t; // fallback
  }

  // محلل CSV بسيط جداً
  function parseCSV(text) {
    if (!text) return null;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return null;
    const headerCols = lines[0].split(/,|;|\t/).map(h => h.trim().toLowerCase());
    const hasHeader = headerCols.includes('time') && headerCols.includes('open');
    const start = hasHeader ? 1 : 0;

    // حاول إيجاد فهارس الأعمدة
    const idx = {
      time: headerCols.indexOf('time'),
      open: headerCols.indexOf('open'),
      high: headerCols.indexOf('high'),
      low: headerCols.indexOf('low'),
      close: headerCols.indexOf('close'),
      volume: headerCols.indexOf('volume'),
    };

    const out = [];
    for (let i = start; i < lines.length; i++) {
      const parts = lines[i].split(/,|;|\t/).map(p => p.trim()).filter(p => p.length > 0);
      if (parts.length < 5) continue;
      const t = (idx.time >= 0 ? parts[idx.time] : parts[0]);
      const o = parseFloat(idx.open >= 0 ? parts[idx.open] : parts[1]);
      const h = parseFloat(idx.high >= 0 ? parts[idx.high] : parts[2]);
      const l = parseFloat(idx.low >= 0 ? parts[idx.low] : parts[3]);
      const c = parseFloat(idx.close >= 0 ? parts[idx.close] : parts[4]);
      const v = parseInt((idx.volume >= 0 ? parts[idx.volume] : parts[5]) || 0, 10);
      out.push({ time: normalizeTime(t), open: o, high: h, low: l, close: c, volume: isNaN(v) ? 0 : v });
    }

    // ترتيب تصاعدي بحسب الوقت (مهم)
    out.sort((a,b)=>{
      const ta = (typeof a.time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.time)) ? a.time : Number(a.time);
      const tb = (typeof b.time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.time)) ? b.time : Number(b.time);
      if (typeof ta === 'string' && typeof tb === 'string') return ta.localeCompare(tb);
      return (ta || 0) - (tb || 0);
    });

    return out;
  }

  // تحميل البيانات في الشارت
  function loadData(arr) {
    if (!arr || !arr.length) {
      alert('لا توجد بيانات صحيحة للعرض.');
      return;
    }
    // إزالة أي بيانات قائمة ثم عرض الجديدة
    candleSeries.setData(arr.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));
    chart.timeScale().fitContent();
    console.log('Loaded', arr.length, 'rows');
  }

  // زر العيّنة: بيانات ذهب يومية بسيطة
  document.getElementById('btnSample').addEventListener('click', () => {
    const sampleCSV = `time,open,high,low,close,volume
2025-09-05,1965.20,1972.50,1960.10,1968.30,12000
2025-09-04,1958.40,1966.00,1955.00,1964.50,9800
2025-09-03,1960.00,1965.50,1950.30,1957.20,15000
2025-09-02,1948.50,1962.00,1945.00,1958.00,20000
2025-09-01,1945.00,1955.00,1940.50,1950.30,18000
2025-08-31,1938.00,1948.50,1935.00,1945.10,22000
2025-08-30,1940.00,1945.50,1930.00,1938.40,16000
2025-08-29,1935.50,1942.00,1930.00,1940.00,14000
2025-08-28,1928.00,1938.00,1925.00,1935.50,12500
2025-08-27,1925.00,1932.50,1920.00,1928.00,13500`;
    const parsed = parseCSV(sampleCSV);
    loadData(parsed);
  });

  // زر تحميل من النص الملصوق
  document.getElementById('btnPaste').addEventListener('click', () => {
    const text = document.getElementById('input').value;
    const parsed = parseCSV(text);
    if (!parsed || parsed.length === 0) {
      alert('لم يتم العثور على بيانات صالحة في النص الملصوق. تأكد من تنسيق CSV (time,open,high,low,close,volume).');
      return;
    }
    loadData(parsed);
  });

  // مسح الشارت
  document.getElementById('btnClear').addEventListener('click', () => {
    candleSeries.setData([]);
  });

  // تحميل تلقائي للعيّنة عند فتح الصفحة
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnSample').click();
  });

  // إعادة قياس عند تغيير حجم النافذة
  window.addEventListener('resize', () => {
    chart.resize(document.getElementById('chart').clientWidth, Math.max(320, window.innerHeight * 0.6));
  });
})();
