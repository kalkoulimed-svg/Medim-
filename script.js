/* ==========================================================
   Medim Cash - المنطق والحسابات والحفظ
   كل البيانات تتحفظ في localStorage داخل هاتف المستخدم.
   ========================================================== */
(function () {
  'use strict';

  var KEY = 'medimcash.v1';
  var mem = null;

  var CATS = [
    ['ess', 'الضروريات', '#3DDC97'], ['home', 'المنزل والعائلة', '#7AA2FF'],
    ['health', 'الصحة', '#FF6B5E'], ['fun', 'الكماليات', '#E8C468'],
    ['move', 'المواصلات', '#B08CFF'], ['cloth', 'الملابس', '#FF8FB8'],
    ['edu', 'التعليم', '#5ED0E8'], ['food', 'المطاعم', '#FFA45E']
  ];
  var TABS = [
    ['home', 'الرئيسية', '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>'],
    ['exp', 'المصاريف', '<path d="M4 6h16M4 12h16M4 18h10"/>'],
    ['save', 'الادخار', '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h5a2 2 0 010 4H9"/>'],
    ['inv', 'الاستثمار', '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'],
    ['debt', 'الديون', '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>']
  ];
  var LOGO = '<img src="icons/logo-mark.png" alt="">';

  var tab = 'home';
  var S = load();
  var pick = 'ess';
  var inv = { m: 10000, y: 10, r: 8 };
  var installEvt = null;

  /* ---------- أدوات ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function N(n) { return '<span class="num">' + fmt(n) + '</span>'; }
  function day0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function clampDay(y, m, d) { return new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate())); }
  function iso(d) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function cat(id) { for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === id) return CATS[i]; return ['x', 'أخرى', '#9A9A94']; }
  function val(id) { return document.getElementById(id).value; }
  function posNum(id) { var v = parseFloat(val(id)); return isFinite(v) && v > 0 ? v : 0; }
  function sum(l, f) { return l.reduce(function (a, x) { return a + (f(x) ? x.amount : 0); }, 0); }
  function cmp(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.id < b.id ? 1 : -1); }

  /* ---------- الحفظ ---------- */
  function seed() {
    var t = day0(new Date()), id = 0;
    var mk = function (off, type, amt, c, note, extra) {
      var d = new Date(t); d.setDate(d.getDate() - off);
      var o = { id: 's' + (id++), date: iso(d), type: type, amount: amt, cat: c, note: note };
      for (var k in extra) o[k] = extra[k];
      return o;
    };
    return {
      demo: true, income: 60000, carry: 0, payDay: 1, mode: 'snow',
      goals: [{ id: 'g1', name: 'صندوق الطوارئ', target: 90000, saved: 20000 }, { id: 'g2', name: 'هاتف جديد', target: 50000, saved: 10000 }],
      debts: [{ id: 'd1', name: 'سمير', total: 16000, paid: 0, rate: 0 }, { id: 'd2', name: 'بلال', total: 3400, paid: 2300, rate: 0 }],
      tx: [
        mk(0, 'exp', 1200, 'food', 'غداء مع العائلة'), mk(1, 'exp', 3500, 'ess', 'خضر وفواكه ومواد غذائية'),
        mk(2, 'exp', 900, 'move', 'وقود'), mk(3, 'exp', 4200, 'home', 'فاتورة الكهرباء والغاز'),
        mk(3, 'exp', 1500, 'health', 'دواء'), mk(4, 'exp', 2000, 'fun', 'خرجة مع الأصدقاء'),
        mk(5, 'save', 5000, '', 'إيداع في صندوق الطوارئ', { goal: 'g1' }),
        mk(5, 'debt', 1000, '', 'تسديد لبلال', { debt: 'd2' })
      ]
    };
  }
  function load() {
    try { var r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) {}
    return mem || seed();
  }
  function save() { mem = S; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- الحسابات ---------- */
  // الدورة المالية: من يوم نزول الراتب إلى الراتب القادم
  function cycle() {
    var t = day0(new Date()), y = t.getFullYear(), m = t.getMonth(), st = clampDay(y, m, S.payDay);
    if (st > t) st = clampDay(y, m - 1, S.payDay);
    var nx = clampDay(st.getFullYear(), st.getMonth() + 1, S.payDay);
    var el = Math.floor((t - st) / 864e5) + 1;
    var rem = Math.max(1, Math.round((nx - t) / 864e5));
    return { st: st, nx: nx, el: el, rem: rem };
  }
  function metrics() {
    var c = cycle(), a = iso(c.st), b = iso(c.nx);
    var tx = S.tx.filter(function (x) { return x.date >= a && x.date < b; });
    var spent = sum(tx, function (x) { return x.type === 'exp'; });
    var saved = sum(tx, function (x) { return x.type === 'save'; });
    var paid = sum(tx, function (x) { return x.type === 'debt'; });
    var budget = S.income + S.carry, bal = budget - spent - saved - paid;
    return {
      c: c, tx: tx, spent: spent, saved: saved, paid: paid, budget: budget, bal: bal,
      pct: budget > 0 ? Math.min(100, (spent + saved + paid) / budget * 100) : 0,
      avg: spent / c.el,
      safe: Math.max(0, bal) / c.rem   // الصرف الآمن = الرصيد ÷ الأيام المتبقية
    };
  }
  function totalSaved() { return S.goals.reduce(function (a, g) { return a + g.saved; }, 0); }
  function debtLeft() { return S.debts.reduce(function (a, d) { return a + Math.max(0, d.total - d.paid); }, 0); }
  function fv(m, y, r) { var i = r / 1200, n = y * 12; return i === 0 ? m * n : m * ((Math.pow(1 + i, n) - 1) / i); }
  function fmtK(v) { return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : String(Math.round(v)); }
  function sortedDebts() {
    var a = S.debts.filter(function (d) { return d.total - d.paid > 0; });
    a.sort(S.mode === 'snow' ? function (x, y) { return (x.total - x.paid) - (y.total - y.paid); } : function (x, y) { return (y.rate || 0) - (x.rate || 0); });
    return a;
  }

  /* ---------- مكوّنات مشتركة ---------- */
  function step(t, d, done) { return '<div class="step' + (done ? ' done' : '') + '"><span class="n">' + (done ? '✓' : '•') + '</span><div><b>' + t + '</b><p class="muted">' + d + '</p></div></div>'; }
  function split() {
    return '<div class="bar3"><span style="width:50%;background:#2A7FBF">50%</span><span style="width:30%;background:#B7861A">30%</span><span style="width:20%;background:#0F8F5F">20%</span></div>' +
      '<div class="legend"><span>ضروريات: ' + N(S.income * .5) + ' دج</span><span>كماليات: ' + N(S.income * .3) + ' دج</span><span>ادخار واستثمار: ' + N(S.income * .2) + ' دج</span><span></span></div>';
  }
  function txList(l) {
    if (!l.length) return '<div class="empty">ما كاين حتى عملية. اضغط «سجّل مصروف» للبداية.</div>';
    return '<div class="list">' + l.map(function (x) {
      var c = x.type === 'exp' ? cat(x.cat) : x.type === 'save' ? ['s', 'ادخار', '#3DDC97'] : ['d', 'دين', '#FFD21F'];
      var plus = x.type === 'save' && x.amount < 0;
      return '<div class="item"><i class="dot" style="background:' + c[2] + '"></i><div class="t"><b>' + esc(x.note || c[1]) + '</b><span class="muted">' + c[1] + ' · <span class="num">' + x.date + '</span></span></div><span class="' + (plus ? 'in' : 'out') + '">' + (plus ? '+' : '-') + N(Math.abs(x.amount)) + ' دج</span></div>';
    }).join('') + '</div>';
  }
  function installCard() {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (standalone) return '';
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (installEvt) return '<div class="card install stack-col"><h3>ثبّت Medim Cash</h3><p class="muted">افتحه من الشاشة الرئيسية بدون متصفح.</p><button class="cta" data-act="install">تثبيت التطبيق</button></div>';
    if (ios) return '<div class="card install stack-col"><h3>ثبّت Medim Cash على الآيفون</h3><p class="muted">في Safari اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية».</p></div>';
    return '';
  }

  /* ---------- الصفحات ---------- */
  function vHome() {
    var m = metrics(), cls = m.pct > 85 ? 'bad' : m.pct > 65 ? 'warn' : '';
    var h = '<div class="hero"><div><div class="lbl">الرصيد الحالي</div><div class="big num">' + fmt(m.bal) + '<small>دج</small></div><div class="lbl">رصيد الدورة: ' + N(m.budget) + ' دج</div></div>' +
      '<div><div class="top-row lbl" style="margin-bottom:6px"><span>نسبة الاستهلاك</span><span class="num">' + Math.round(m.pct) + '%</span></div><div class="track ' + cls + '"><i style="width:' + m.pct + '%"></i></div></div></div>';
    h += '<div class="row2"><div class="card stat"><span class="muted">المصاريف</span><span class="v out">' + N(m.spent) + '<small>دج</small></span></div>' +
      '<div class="card stat"><span class="muted">الأيام المتبقية</span><span class="v">' + N(m.c.rem) + '<small>يوم</small></span></div>' +
      '<div class="card stat"><span class="muted">المعدل اليومي</span><span class="v">' + N(m.avg) + '<small>دج</small></span></div>' +
      '<div class="card stat"><span class="muted">الادخار هذه الدورة</span><span class="v in">' + N(m.saved) + '<small>دج</small></span></div></div>';
    h += '<div class="card safe"><div style="flex:1"><h3>الصرف الآمن يومياً</h3><p class="muted">تقدر تصرف هذا المبلغ كل يوم حتى الراتب القادم بدون ما تتجاوز الميزانية.</p></div><div class="v"><span class="num">' + fmt(m.safe) + '</span> دج</div></div>';
    if (m.c.el > 1 && m.avg > m.safe && m.avg > 0) h += '<div class="card alert"><b>تنبيه:</b> معدلك اليومي (' + N(m.avg) + ' دج) أعلى من الصرف الآمن. قلّل المصاريف غير الضرورية باش توصل لآخر الدورة.</div>';
    h += installCard();
    h += '<div class="card"><div class="top-row"><h3>آخر العمليات</h3><button class="ghost" data-go="exp">عرض الكل</button></div>' + txList(m.tx.slice().sort(cmp).slice(0, 4)) + '</div>';
    h += '<div class="card"><h3>خطة 50 / 30 / 20</h3><p class="muted" style="margin-bottom:10px">قسّم الراتب بين الضروريات والكماليات والادخار.</p>' + split() + '</div>';
    return h;
  }
  function vExp() {
    var m = metrics(), ex = m.tx.filter(function (x) { return x.type === 'exp'; }), tot = m.spent;
    var by = CATS.map(function (c) { return [c, sum(ex, function (x) { return x.cat === c[0]; })]; }).filter(function (p) { return p[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
    var h = '<div class="card stat"><span class="muted">مصاريف هذه الدورة</span><span class="v out">' + N(tot) + '<small>دج</small></span></div>';
    h += '<div class="card"><h3 style="margin-bottom:10px">توزيع المصاريف</h3>';
    if (!by.length) h += '<div class="empty">سجّل أول مصروف باش تشوف التوزيع.</div>';
    else h += '<div class="stackbar">' + by.map(function (p) { return '<i style="width:' + p[1] / tot * 100 + '%;background:' + p[0][2] + '"></i>'; }).join('') + '</div><div class="legend">' + by.map(function (p) { return '<span><i class="dot" style="background:' + p[0][2] + '"></i>' + p[0][1] + ' <span class="num">' + Math.round(p[1] / tot * 100) + '%</span></span>'; }).join('') + '</div>';
    h += '</div><div class="card"><h3>سجل العمليات</h3>' + txList(m.tx.slice().sort(cmp)) + '</div>';
    return h;
  }
  function vSave() {
    var h = '<div class="card stat"><span class="muted">إجمالي مدخراتك</span><span class="v in">' + N(totalSaved()) + '<small>دج</small></span></div>';
    h += S.goals.length ? S.goals.map(function (g) {
      var p = Math.min(100, g.saved / g.target * 100);
      return '<div class="card goal stack-col"><div class="top-row"><h3>' + esc(g.name) + '</h3><span class="tag' + (p >= 100 ? ' ok' : '') + '">' + (p >= 100 ? 'تحقق الهدف' : Math.round(p) + '%') + '</span></div><div class="track"><i style="width:' + p + '%"></i></div><div class="top-row muted"><span>' + N(g.saved) + ' دج</span><span>الهدف ' + N(g.target) + ' دج</span></div><div class="row2"><button class="ghost" data-act="dep" data-id="' + g.id + '">إيداع</button><button class="ghost" data-act="wd" data-id="' + g.id + '">سحب</button></div></div>';
    }).join('') : '<div class="card empty">ما عندك حتى هدف. أضف هدفك الأول.</div>';
    h += '<button class="cta" data-act="newgoal">+ هدف ادخاري جديد</button>';
    h += '<div class="card"><h3>كيف تدّخر؟</h3><div class="steps">' +
      step('ادفع لنفسك أولاً', 'أول ما ينزل الراتب، حوّل مبلغ الادخار قبل أي مصروف. المقترح: ' + fmt(S.income * .2) + ' دج.') +
      step('حدّد هدفاً واضحاً', 'هدف بمبلغ يخلّيك تكمل. ابدأ بصندوق الطوارئ.') +
      step('فرّق بين الحساب اليومي والادخار', 'خلّي المدخرات بعيدة عن المصروف اليومي باش ما تصرفهاش.') +
      step('راجع كل نهاية دورة', 'إذا بقى رصيد في الأخير، زيدو في الهدف.') + '</div></div>';
    return h;
  }
  function vInv() {
    var mAvg = metrics().spent || S.income * .5, ef = totalSaved() >= mAvg * 3, dc = debtLeft() === 0;
    var h = '<div class="card"><h3>السلّم قبل الاستثمار</h3><div class="steps">' +
      step('صندوق طوارئ = 3 أشهر مصاريف', 'المطلوب تقريباً ' + fmt(mAvg * 3) + ' دج. عندك ' + fmt(totalSaved()) + ' دج.', ef) +
      step('سدّد الديون', 'المتبقي من ديونك: ' + fmt(debtLeft()) + ' دج.', dc) +
      step('استثمر مبلغاً ثابتاً كل شهر', 'ابدأ صغير ونوّع. ما تستثمرش مال تحتاجه خلال سنة.', ef && dc) + '</div></div>';
    h += '<div class="card stack-col" style="gap:12px"><h3>حاسبة النمو</h3>' +
      '<label class="f">مبلغ شهري (دج)<input type="number" inputmode="numeric" id="iM" value="' + inv.m + '" min="0"></label>' +
      '<div class="row2"><label class="f">المدة (سنوات)<input type="number" inputmode="numeric" id="iY" value="' + inv.y + '" min="1" max="40"></label>' +
      '<label class="f">عائد سنوي متوقع %<input type="number" inputmode="decimal" id="iR" value="' + inv.r + '" min="0" max="30" step="0.5"></label></div><div id="invOut"></div>' +
      '<p class="note">حاسبة تعليمية بعائد افتراضي. العوائد الحقيقية تتغير وقد تكون سالبة. استشر مختصاً قبل أي قرار.</p></div>';
    h += '<div class="card"><h3>أفكار لتوزيع الاستثمار</h3><div class="legend one"><span><i class="dot" style="background:#3DDC97"></i>أمان: ذهب، ودائع، ادخار طويل المدى</span><span><i class="dot" style="background:#FFD21F"></i>نمو: مشروع صغير أو تجارة تعرفها</span><span><i class="dot" style="background:#7AA2FF"></i>مهارة: دورة أو أداة ترفع دخلك</span></div></div>';
    return h;
  }
  function invOut() {
    var m = +inv.m || 0, y = Math.max(1, Math.min(40, +inv.y || 1)), r = +inv.r || 0;
    var end = fv(m, y, r), dep = m * 12 * y, W = 300, H = 120, px = 34, py = 14, mx = Math.max(end, dep, 1);
    var X = function (i) { return px + i / y * (W - px - 8); }, Y = function (v) { return H - py - v / mx * (H - 2 * py); };
    var A = [], B = [];
    for (var i = 0; i <= y; i++) { A.push(X(i).toFixed(1) + ',' + Y(fv(m, i, r)).toFixed(1)); B.push(X(i).toFixed(1) + ',' + Y(m * 12 * i).toFixed(1)); }
    return '<div class="row2"><div class="stat"><span class="muted">القيمة بعد ' + y + ' سنة</span><span class="v in">' + N(end) + '<small>دج</small></span></div><div class="stat"><span class="muted">ما دفعته</span><span class="v">' + N(dep) + '<small>دج</small></span></div></div>' +
      '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="نمو الاستثمار"><line x1="' + px + '" y1="' + (H - py) + '" x2="' + (W - 8) + '" y2="' + (H - py) + '" stroke="#2A2A2A"/>' +
      '<polyline points="' + B.join(' ') + '" fill="none" stroke="#9A9A94" stroke-width="2" stroke-dasharray="4 3"/><polyline points="' + A.join(' ') + '" fill="none" stroke="#3DDC97" stroke-width="2.5"/>' +
      '<text x="2" y="' + (Y(mx) + 4) + '">' + fmtK(mx) + '</text><text x="' + px + '" y="' + (H - 2) + '">0</text><text x="' + (W - 8) + '" y="' + (H - 2) + '" text-anchor="end">' + y + 'y</text></svg>' +
      '<div class="legend"><span><i class="dot" style="background:#3DDC97"></i>مع العائد</span><span><i class="dot" style="background:#9A9A94"></i>المدفوع فقط</span></div>';
  }
  function vDebt() {
    var left = debtLeft(), ord = sortedDebts();
    var h = '<div class="card stat"><span class="muted">إجمالي الديون المتبقية</span><span class="v out">' + N(left) + '<small>دج</small></span></div>';
    h += '<div class="card"><h3>طريقة الترتيب</h3><div class="chips" style="margin-top:10px"><button class="chip" data-mode="snow" aria-pressed="' + (S.mode === 'snow') + '">الأصغر أولاً</button><button class="chip" data-mode="ava" aria-pressed="' + (S.mode === 'ava') + '">الأعلى فائدة أولاً</button></div><p class="muted" style="margin-top:8px">' +
      (S.mode === 'snow' ? 'سدّد الأصغر لتقفل دين بسرعة وتاخذ دفعة معنوية، والباقي بالحد الأدنى.' : 'سدّد الدين بأعلى نسبة فائدة أولاً لتخسر أقل مال. أضف النسبة لكل دين.') + '</p></div>';
    h += S.debts.length ? S.debts.map(function (d) {
      var rest = Math.max(0, d.total - d.paid), p = Math.min(100, d.paid / d.total * 100), i = ord.indexOf(d);
      return '<div class="card debt stack-col"><div class="top-row"><h3>' + esc(d.name) + (d.rate ? ' <span class="muted num">' + d.rate + '%</span>' : '') + '</h3>' +
        (rest === 0 ? '<span class="tag ok">مسدّد</span>' : i === 0 ? '<span class="tag">ابدأ بهذا</span>' : '<span class="tag gray">الأولوية ' + (i + 1) + '</span>') +
        '</div><div class="track"><i style="width:' + p + '%"></i></div><div class="top-row muted"><span>المتبقي ' + N(rest) + ' دج</span><span>الكلي ' + N(d.total) + ' دج · ' + Math.round(p) + '%</span></div>' +
        (rest > 0 ? '<button class="ghost" data-act="pay" data-id="' + d.id + '">تسديد دفعة</button>' : '') + '</div>';
    }).join('') : '<div class="card empty">الحمد لله، ما عندك ديون مسجلة.</div>';
    h += '<button class="cta" data-act="newdebt">+ دين جديد</button>';
    h += '<div class="card"><h3>قواعد بسيطة</h3><div class="steps">' + step('سجّل كل دين', 'الاسم، المبلغ، والنسبة إن وجدت.') + step('خصّص مبلغاً ثابتاً كل شهر', 'من الراتب مباشرة، قبل الكماليات.') + step('لا تستدن لتسدد', 'إلا لتقليل الفائدة وبخطة واضحة.') + '</div></div>';
    return h;
  }

  /* ---------- الرسم ---------- */
  function render() {
    var h = '<header class="top"><div class="brand"><span class="logo">' + LOGO + '</span><div>Medim Cash<small>فلوسك تحت السيطرة</small></div></div>' +
      '<button class="iconbtn" data-act="settings" aria-label="الإعدادات"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 002 1.2l.4 2.6h4l.4-2.6a7 7 0 002-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg></button></header>';
    if (S.demo) h += '<div class="demo"><span>هذه أرقام مثال لتجرب التطبيق.</span><button data-act="settings">ابدأ بأرقامك</button></div>';
    h += '<main>' + { home: vHome, exp: vExp, save: vSave, inv: vInv, debt: vDebt }[tab]() + '</main>';
    h += '<nav class="tabs"><div>' + TABS.map(function (t) { return '<button data-go="' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24">' + t[2] + '</svg>' + t[1] + '</button>'; }).join('') + '</div></nav>';
    if (tab === 'home' || tab === 'exp') h += '<button class="fab" data-act="addexp"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>سجّل مصروف</button>';
    document.getElementById('app').innerHTML = h;
    if (tab === 'inv') bindInv();
  }
  function bindInv() {
    var o = document.getElementById('invOut'); o.innerHTML = invOut();
    [['iM', 'm'], ['iY', 'y'], ['iR', 'r']].forEach(function (p) {
      document.getElementById(p[0]).addEventListener('input', function (e) { inv[p[1]] = e.target.value; o.innerHTML = invOut(); });
    });
  }

  /* ---------- النوافذ ---------- */
  function sheet(html) { document.getElementById('layer').innerHTML = '<div class="scrim" data-close="1"><div class="sheet" role="dialog" aria-modal="true">' + html + '</div></div>'; }
  function closeSheet() { document.getElementById('layer').innerHTML = ''; }
  function sheetExp() {
    pick = 'ess';
    sheet('<h2>تسجيل مصروف</h2><label class="f">المبلغ (دج)<input class="amount" type="number" inputmode="numeric" id="fA" placeholder="0" min="0"></label><div class="muted">اختر نوع المصروف</div><div class="cats" id="fC">' +
      CATS.map(function (c) { return '<button data-cat="' + c[0] + '" aria-pressed="' + (c[0] === pick) + '"><i class="dot" style="background:' + c[2] + '"></i>' + c[1] + '</button>'; }).join('') +
      '</div><label class="f">ملاحظة (اختياري)<input type="text" id="fN" maxlength="60" placeholder="مثلاً: خبز وحليب"></label><button class="cta" data-act="saveexp">حفظ المصروف</button>');
    setTimeout(function () { var e = document.getElementById('fA'); if (e) e.focus(); }, 50);
  }
  function amtSheet(title, btn, act, id, extra) {
    sheet('<h2>' + title + '</h2>' + (extra || '') + '<label class="f">المبلغ (دج)<input class="amount" type="number" inputmode="numeric" id="fA" placeholder="0" min="0"></label><button class="cta" data-act="' + act + '" data-id="' + (id || '') + '">' + btn + '</button>');
  }
  function sheetSettings() {
    sheet('<h2>إنشاء ميزانيتك</h2><p class="muted">أدخل أرقامك الحقيقية. التطبيق ينتقل لدورة جديدة تلقائياً في يوم الراتب.</p>' +
      '<label class="f">الراتب / الدخل الشهري (دج)<input type="number" inputmode="numeric" id="sI" value="' + S.income + '" min="0"></label>' +
      '<label class="f">رصيد مرحّل من الدورة السابقة (دج)<input type="number" inputmode="numeric" id="sC" value="' + S.carry + '" min="0"></label>' +
      '<label class="f">يوم نزول الراتب من الشهر<input type="number" inputmode="numeric" id="sD" value="' + S.payDay + '" min="1" max="31"></label>' +
      '<button class="cta" data-act="savecfg">' + (S.demo ? 'احذف الأمثلة وابدأ' : 'حفظ') + '</button><button class="ghost danger" data-act="reset">مسح كل البيانات</button>');
  }

  /* ---------- الأحداث ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go],[data-act],[data-cat],[data-mode],[data-close]');
    if (!t) return;
    if (t.dataset.close) { if (e.target === t) closeSheet(); return; }
    if (t.dataset.go) { tab = t.dataset.go; render(); window.scrollTo(0, 0); return; }
    if (t.dataset.cat) { pick = t.dataset.cat; [].forEach.call(document.querySelectorAll('#fC button'), function (b) { b.setAttribute('aria-pressed', b.dataset.cat === pick); }); return; }
    if (t.dataset.mode) { S.mode = t.dataset.mode; save(); render(); return; }

    var a = t.dataset.act, id = t.dataset.id, today = iso(day0(new Date())), g, d, n;
    if (a === 'addexp') sheetExp();
    else if (a === 'saveexp') {
      n = posNum('fA'); if (!n) { document.getElementById('fA').focus(); return; }
      S.tx.push({ id: 't' + Date.now(), date: today, type: 'exp', amount: n, cat: pick, note: val('fN').trim() });
      save(); closeSheet(); render();
    }
    else if (a === 'settings') sheetSettings();
    else if (a === 'savecfg') {
      if (S.demo) { S.tx = []; S.goals = []; S.debts = []; S.demo = false; }
      S.income = posNum('sI'); S.carry = posNum('sC'); S.payDay = Math.max(1, Math.min(31, Math.round(posNum('sD')) || 1));
      save(); closeSheet(); render();
    }
    else if (a === 'reset') { S = { demo: false, income: 0, carry: 0, payDay: 1, goals: [], debts: [], mode: 'snow', tx: [] }; save(); closeSheet(); render(); sheetSettings(); }
    else if (a === 'dep') amtSheet('إيداع في الهدف', 'تأكيد الإيداع', 'dodep', id, '<p class="muted">يُخصم المبلغ من رصيدك الحالي.</p>');
    else if (a === 'wd') amtSheet('سحب من الهدف', 'تأكيد السحب', 'dowd', id, '<p class="muted">يرجع المبلغ إلى رصيدك الحالي.</p>');
    else if (a === 'dodep' || a === 'dowd') {
      g = S.goals.filter(function (x) { return x.id === id; })[0]; n = posNum('fA'); if (!g || !n) return;
      if (a === 'dowd') n = Math.min(n, g.saved);
      var sg = a === 'dodep' ? 1 : -1; g.saved += sg * n;
      S.tx.push({ id: 't' + Date.now(), date: today, type: 'save', amount: sg * n, cat: '', note: (sg > 0 ? 'إيداع في ' : 'سحب من ') + g.name, goal: id });
      save(); closeSheet(); render();
    }
    else if (a === 'newgoal') sheet('<h2>هدف ادخاري جديد</h2><label class="f">اسم الهدف<input type="text" id="gN" maxlength="40" placeholder="مثلاً: سيارة، عمرة، حاسوب"></label><label class="f">المبلغ المطلوب (دج)<input type="number" inputmode="numeric" id="gT" min="1"></label><button class="cta" data-act="savegoal">إضافة الهدف</button>');
    else if (a === 'savegoal') { var nm = val('gN').trim(), tg = posNum('gT'); if (!nm || !tg) return; S.goals.push({ id: 'g' + Date.now(), name: nm, target: tg, saved: 0 }); save(); closeSheet(); render(); }
    else if (a === 'newdebt') sheet('<h2>دين جديد</h2><label class="f">اسم الدائن<input type="text" id="dN" maxlength="40"></label><label class="f">المبلغ الكلي (دج)<input type="number" inputmode="numeric" id="dT" min="1"></label><label class="f">نسبة الفائدة % (اختياري)<input type="number" inputmode="decimal" id="dR" min="0" step="0.5" value="0"></label><button class="cta" data-act="savedebt">إضافة الدين</button>');
    else if (a === 'savedebt') { var dn = val('dN').trim(), dt = posNum('dT'); if (!dn || !dt) return; S.debts.push({ id: 'd' + Date.now(), name: dn, total: dt, paid: 0, rate: parseFloat(val('dR')) || 0 }); save(); closeSheet(); render(); }
    else if (a === 'pay') amtSheet('تسديد دفعة', 'تأكيد التسديد', 'dopay', id, '<p class="muted">تُخصم الدفعة من رصيدك الحالي.</p>');
    else if (a === 'dopay') {
      d = S.debts.filter(function (x) { return x.id === id; })[0]; n = posNum('fA'); if (!d || !n) return;
      n = Math.min(n, d.total - d.paid); d.paid += n;
      S.tx.push({ id: 't' + Date.now(), date: today, type: 'debt', amount: n, cat: '', note: 'تسديد لـ ' + d.name, debt: id });
      save(); closeSheet(); render();
    }
    else if (a === 'install' && installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; render(); }); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  /* ---------- PWA ---------- */
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (!document.getElementById('layer').innerHTML) render(); });
  window.addEventListener('appinstalled', function () { installEvt = null; render(); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  render();
})();
