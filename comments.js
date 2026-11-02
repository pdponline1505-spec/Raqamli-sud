/* Raqamli sud — izohlar qatlami (sahifaga qadaladigan izohlar, javoblar, hal qilish).
   Ma'lumotlar /api/comments orqali saqlanadi (api/comments.js). */
(function () {
  'use strict';
  var API = '/api/comments';
  var LS_NAME = 'rs.cname', LS_OPEN = 'rs.openAfter', LS_REPLAY = 'rs.replay';
  var S = { list: [], mode: false, draft: null, open: null, panel: false, tab: 'open', q: '', scr: 'all', configured: true, loaded: false, err: '', flash: null };

  // ---------- yordamchilar ----------
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v; // faqat ichki SVG ikonlar uchun
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  var IC = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
  };
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) {} }
  function colorOf(name) { var hsh = 0; for (var i = 0; i < name.length; i++) hsh = (hsh * 31 + name.charCodeAt(i)) | 0; var C = ['#2563eb', '#7c3aed', '#db2777', '#0891b2', '#16a34a', '#ea580c', '#4f46e5', '#0d9488']; return C[Math.abs(hsh) % C.length]; }
  function ini(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '?'; }
  function ago(t) {
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'hozirgina'; if (s < 3600) return Math.floor(s / 60) + ' daq oldin'; if (s < 86400) return Math.floor(s / 3600) + ' soat oldin';
    var d = new Date(t), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // ---------- joriy ekran (ilova o'z holatini localStorage'ga yozadi) ----------
  function nav() { try { return JSON.parse(lsGet('adolat.nav') || '{}') || {}; } catch (e) { return {}; } }
  function screen() {
    var n = nav(), page = n.page || 'dash';
    if (n.caseOpen && n.caseNum) return { key: 'case:' + n.caseNum, label: 'Ish ' + n.caseNum, nav: n };
    if (page === 'list') return { key: 'list|' + (n.lInst || '') + '|' + (n.lTab || ''), label: (n.lInst || 'Ishlar ro\'yxati') + (n.lTab ? ' · ' + tabName(n.lTab) : ''), nav: n };
    if (page === 'devon') return { key: 'devon', label: 'Devonxona', nav: n };
    return { key: 'dash', label: 'Bosh sahifa', nav: n };
  }
  function tabName(k) {
    var el = document.querySelector('.seg-tabs .on'); if (el) return (el.childNodes[0] && el.childNodes[0].textContent || el.textContent).trim();
    return k;
  }

  // ---------- element manzili ----------
  function selOf(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) { parts.unshift('#' + el.id); break; }
      var i = 1, sib = el; while ((sib = sib.previousElementSibling)) i++;
      parts.unshift(el.tagName.toLowerCase() + ':nth-child(' + i + ')');
      el = el.parentElement;
    }
    if (parts.length && parts[0].charAt(0) !== '#') parts.unshift('body');
    return parts.join(' > ');
  }
  function txt(el) { return ((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim(); }
  function describe(el) {
    var t = ((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || '').trim(), cur = el, g = 0;
    while (!t && cur && g++ < 6) { var x = txt(cur); if (x && x.length <= 70) { t = x; break; } cur = cur.parentElement; }
    if (!t) { var y = txt(el); t = y.slice(0, 60) + (y.length > 60 ? '…' : ''); }
    var sec = el.closest && el.closest('section,.d2-k,.d2-card,.db-card,.iv-card,.l-row,.sec,.card,aside,[role="dialog"]');
    var hd = sec && sec.querySelector('h1,h2,h3,[role="heading"],.d2-ch b,.d3-ht b,.d2-kt b,b');
    var ht = hd ? txt(hd).slice(0, 50) : '';
    var out = (ht && ht !== t && t.indexOf(ht) !== 0 ? ht + ' › ' : '') + (t || el.tagName.toLowerCase());
    return out.slice(0, 140);
  }
  function tc(el) { return ((el && el.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 120); }
  // element qaysi oyna / menyu / bo'lim ichida ekanini yozib qo'yamiz
  function ctxOf(el) {
    var out = [], cur = el && el.parentElement, g = 0;
    while (cur && cur !== document.body && g++ < 60) {
      var role = cur.getAttribute('role'), lab = cur.getAttribute('aria-label'), t = '';
      if (lab && /^(dialog|listbox|menu|alertdialog)$/.test(role || '')) t = lab;
      else {
        for (var k = 0; k < cur.children.length && !t; k++) {
          var ch = cur.children[k], hd = /^H[1-3]$/.test(ch.tagName) ? ch : (ch.children.length <= 3 && ch.firstElementChild && /^H[1-3]$/.test(ch.firstElementChild.tagName) ? ch.firstElementChild : null);
          if (hd && !hd.contains(el)) t = txt(hd.querySelector('.dx-ht') || hd).slice(0, 60);
        }
      }
      if (!t) { var cs = getComputedStyle(cur); if ((cs.position === 'absolute' || cs.position === 'fixed') && cs.boxShadow !== 'none' && cur.firstElementChild && !cur.firstElementChild.contains(el)) { var ft = txt(cur.firstElementChild.firstElementChild || cur.firstElementChild); if (ft && ft.length <= 40) t = ft; } }
      if (t && out.indexOf(t) < 0) out.unshift(t);
      cur = cur.parentElement;
    }
    return out.slice(-4).join(' › ');
  }
  // izoh elementini topish: avval manzil (selector), u o'zgargan bo'lsa — matni bo'yicha
  var EC = {};
  function vis(el) { return el && el.isConnected && el.getClientRects().length > 0; }
  function byText(c) {
    if (!c.fp || !c.tag) return null;
    var list = document.querySelectorAll(c.tag), hit = null, best = -1, want = c.sel.split(' > ');
    for (var i = 0; i < list.length; i++) {
      var el = list[i]; if (root.contains(el) || el.closest('[data-ghost]') || tc(el) !== c.fp || !vis(el)) continue;
      // bir xil matnli elementlar ko'p bo'lsa — manzili eng o'xshashini olamiz
      var got = selOf(el).split(' > '), k = 0; while (k < got.length && k < want.length && got[k] === want[k]) k++;
      if (k > best) { best = k; hit = el; }
    }
    return hit;
  }
  // selector topgan element haqiqatan o'sha joymi (yopiq menyu o'rnida boshqa element bo'lib qolmasin)
  function same(c, el) {
    if (c.fp) return tc(el).slice(0, 30) === c.fp.slice(0, 30);
    var seg = (c.where || '').split(' › ').pop().replace(/…$/, '').trim(); if (!seg) return true;
    for (var e = el, g = 0; e && g < 7; e = e.parentElement, g++) {
      if ((e.getAttribute('aria-label') || e.getAttribute('title') || '').indexOf(seg) >= 0 || tc(e).indexOf(seg.slice(0, 40)) >= 0) return true;
    }
    return false;
  }
  function findEl(c) {
    if (!c || !c.sel) return null;
    var key = c._k || (c === S.draft ? '__d' : c.id), e = EC[key], now = Date.now();
    if (e && now - e.t < 500 && (e.el ? vis(e.el) : true)) return e.el;
    var el = null; try { el = document.querySelector(c.sel); } catch (x) {}
    if (el && (!vis(el) || !same(c, el) || el.closest('[data-ghost]'))) el = null;
    if (!el) el = byText(c);
    EC[key] = { el: el, t: now };
    return el;
  }
  function rangeOf(c) {
    if (c === S.draft && SEL && SEL.range) return SEL.range;
    if (!c.quote || !c.sel) return null;
    var el = findEl(c); if (!el) return null;
    var nodes = [], full = '', w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { nodes.push([n, full.length]); full += n.nodeValue; }
    var i = full.indexOf(c.quote); if (i < 0) return null;
    var j = i + c.quote.length, rg = document.createRange(), set0 = false;
    for (var k = 0; k < nodes.length; k++) { var nd = nodes[k][0], st = nodes[k][1], en = st + nd.nodeValue.length;
      if (!set0 && i >= st && i <= en) { rg.setStart(nd, i - st); set0 = true; }
      if (set0 && j >= st && j <= en) { rg.setEnd(nd, j - st); return rg; } }
    return null;
  }
  function markQuote() {
    try { if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
      var c = S.draft || (S.open && S.list.filter(function (x) { return x.id === S.open; })[0]);
      var rg = c && rangeOf(c);
      if (rg) CSS.highlights.set('rsc-quote', new Highlight(rg)); else CSS.highlights.delete('rsc-quote');
    } catch (e) {}
  }
  function anchorPos(c) {
    var el = findEl(c);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    var x = r.left + c.rx * r.width, y = r.top + c.ry * r.height;
    if (y < -40 || y > window.innerHeight + 40 || x < -40 || x > window.innerWidth + 40) return { x: x, y: y, off: true };
    return { x: x, y: y };
  }

  // ---------- API ----------
  function api(method, body) {
    return fetch(API, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (r.status === 503) S.configured = false; if (!r.ok) throw new Error(j.message || j.error || ('HTTP ' + r.status)); return j; }); });
  }
  function load() {
    return api('GET').then(function (j) { S.list = j.comments || []; S.configured = true; S.loaded = true; build(); afterLoad(); })
      .catch(function () { S.loaded = true; build(); });
  }

  // ---------- DOM ----------
  var root = h('div', { class: 'rsc-root' });
  var layer = h('div', { class: 'rsc-layer', 'aria-live': 'polite' });
  var fab = h('button', { type: 'button', class: 'rsc-db', 'aria-pressed': 'false', 'aria-label': 'Izoh qoldirish', 'data-tip': 'Izoh qoldirish · C', onclick: function () { setMode(!S.mode); } });
  var listBtn = h('button', { type: 'button', class: 'rsc-db', 'aria-label': 'Izohlar ro\'yxati', 'data-tip': 'Izohlar ro\'yxati · L', onclick: function () { S.panel = !S.panel; build(); } });
  // ixcham panel: o'ng chekkada, kerak bo'lmasa ingichka tilchaga yig'iladi
  var LS_DOCK = 'rs.dockMin';
  var dockMin = lsGet(LS_DOCK) === '1';
  var dockHide = h('button', { type: 'button', class: 'rsc-db rsc-dmin', 'aria-label': 'Izoh panelini yig\'ish', 'data-tip': 'Yig\'ish', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>', onclick: function () { dockMin = true; lsSet(LS_DOCK, '1'); build(); } });
  var dockTab = h('button', { type: 'button', class: 'rsc-dtab', 'aria-label': 'Izoh panelini ochish', title: 'Izohlar', onclick: function () { dockMin = false; lsSet(LS_DOCK, null); build(); } });
  var dock = h('div', { class: 'rsc-dock', role: 'toolbar', 'aria-label': 'Izohlar' }, [fab, listBtn, dockHide]);
  var hint = null, panel = null;
  // hover (komponent tanlash) va matn belgilash uchun qatlam
  var hl = h('div', { class: 'rsc-layer rsc-hl' });
  var hbox = h('div', { class: 'rsc-hbox' }), hlabel = h('span', { class: 'rsc-hlabel' }); hbox.appendChild(hlabel);
  var abox = h('div', { class: 'rsc-abox' });
  hl.appendChild(abox); hl.appendChild(hbox);
  var selBtn = h('button', { type: 'button', class: 'rsc-selbtn', 'aria-label': 'Belgilangan matnga izoh qoldirish' });
  root.appendChild(hl); root.appendChild(layer); root.appendChild(dock); root.appendChild(dockTab); root.appendChild(selBtn);
  var HOV = { base: null, up: 0, el: null, label: '' }, SEL = null;
  function climb(el, n) { while (n-- > 0 && el && el.parentElement && el.parentElement !== document.body) el = el.parentElement; return el; }
  // menyu ortidagi shaffof "yopish" qatlamlarini o'tkazib yuboramiz
  function backdrop(el) {
    var r = el.getBoundingClientRect();
    if (r.width < window.innerWidth * .9 || r.height < window.innerHeight * .9) return false;
    if (tc(el)) return false;
    var bg = getComputedStyle(el).backgroundColor;
    return !bg || bg === 'transparent' || /rgba\(.*,\s*0(\.0+)?\)$/.test(bg) || /yopish|close/i.test(el.getAttribute('aria-label') || '');
  }
  function pick(x, y) {
    var list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
    for (var i = 0; i < list.length; i++) { var el = list[i]; if (inUi(el) || el === document.documentElement || el === document.body) continue; if (backdrop(el)) continue; return el; }
    return null;
  }
  // sichqoncha ostidagi eng yaqin "komponent" (karta, tugma, qator, rasm...) gacha ko'tariladi
  function boxy(el) {
    if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA|IMG|SVG|TR|TD|TH|LI|LABEL|svg)$/.test(el.tagName)) return true;
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 18) return false;
    var bg = cs.backgroundColor, hasBg = bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg);
    return hasBg || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 || cs.backgroundImage !== 'none';
  }
  function autoUp(el) { var n = 0, e = el; while (e && e !== document.body && n < 6) { if (boxy(e)) return n; e = e.parentElement; n++; } return 0; }
  function setHover(base, up) {
    HOV.base = base; HOV.up = Math.max(0, up || 0); var el = climb(base, HOV.up);
    if (el !== HOV.el) { HOV.el = el; HOV.label = el ? describe(el) : ''; hlabel.textContent = HOV.label; }
  }

  function roots() { return S.list.filter(function (c) { return !c.parent; }); }
  function replies(id) { return S.list.filter(function (c) { return c.parent === id; }); }
  function numOf(c) { return roots().indexOf(c) + 1; }

  function setMode(on) {
    S.mode = on; if (on) { S.open = null; S.draft = null; }
    document.documentElement.classList.toggle('rsc-mode', on);
    build();
  }

  function build() {
    var open = roots().filter(function (c) { return !c.resolved; }).length;
    var tot = roots().length;
    fab.innerHTML = S.mode ? IC.x : IC.chat; if (open && !S.mode) fab.appendChild(h('b', { text: String(open) }));
    fab.setAttribute('data-tip', S.mode ? 'Bekor qilish · Esc' : 'Izoh qoldirish · C');
    fab.classList.toggle('on', S.mode); fab.setAttribute('aria-pressed', S.mode ? 'true' : 'false');
    listBtn.innerHTML = IC.list; if (tot) listBtn.appendChild(h('b', { class: 'gr', text: String(tot) })); listBtn.classList.toggle('on', S.panel);
    var mini = dockMin && !S.mode && !S.panel;
    dock.classList.toggle('min', mini); dockTab.classList.toggle('show', mini);
    dock.classList.toggle('shift', !!S.panel);
    dockTab.innerHTML = IC.chat; if (open) dockTab.appendChild(h('b', { text: String(open) }));
    if (hint) { hint.remove(); hint = null; }
    if (S.mode) { hint = h('div', { class: 'rsc-hint', text: 'Komponent ustiga olib boring va bosing · ↑ / ↓ — kattaroq / kichikroq blok · Esc — bekor qilish' }); root.appendChild(hint); }
    layer.innerHTML = '';
    var scr = screen();
    roots().forEach(function (c) {
      if (c.screen !== scr.key) return;
      var pin = h('button', { type: 'button', class: 'rsc-pin' + (c.resolved ? ' res' : '') + (S.open === c.id ? ' act' : ''), 'data-id': c.id, 'aria-label': 'Izoh ' + numOf(c) + ': ' + c.author, text: String(numOf(c)),
        onclick: function (e) { e.stopPropagation(); S.open = S.open === c.id ? null : c.id; S.draft = null; build(); } });
      layer.appendChild(pin);
    });
    if (S.draft) { layer.appendChild(h('div', { class: 'rsc-pin draft', 'data-id': '__draft', text: '+' })); layer.appendChild(draftPop()); }
    else if (S.open) { var oc = S.list.filter(function (c) { return c.id === S.open; })[0]; if (oc && oc.screen === scr.key) layer.appendChild(threadPop(oc)); }
    if (panel) { panel.remove(); panel = null; }
    if (S.panel) { panel = buildPanel(); root.appendChild(panel); }
    markQuote();
    position();
  }

  function msgEl(c) {
    return h('div', { class: 'rsc-msg' }, [
      h('span', { class: 'rsc-av', style: 'background:' + colorOf(c.author), text: ini(c.author) }),
      h('div', { class: 'rsc-mb' }, [h('div', { class: 'rsc-mh' }, [h('b', { text: c.author }), h('small', { text: ago(c.at) + (c.edited ? ' · tahrirlangan' : '') })]), h('div', { class: 'rsc-mt', text: c.text })])
    ]);
  }
  function form(opts) {
    var name = h('input', { type: 'text', placeholder: 'Ismingiz', value: lsGet(LS_NAME) || '', maxlength: '60', 'aria-label': 'Ismingiz' });
    var ta = h('textarea', { placeholder: opts.ph, maxlength: '2000', 'aria-label': opts.ph });
    var err = h('div', { class: 'rsc-err' });
    var send = h('button', { type: 'button', class: 'rsc-btn pri', text: opts.btn });
    var go = function () {
      var t = ta.value.trim(); if (!t) { ta.focus(); return; }
      var nm = name.value.trim() || 'Mehmon'; lsSet(LS_NAME, nm);
      send.disabled = true; err.textContent = '';
      opts.submit(nm, t).catch(function (e) { send.disabled = false; err.textContent = S.configured ? 'Saqlab bo\'lmadi: ' + e.message : 'Izohlar xizmati hali sozlanmagan (ma\'lumotlar bazasi ulanmagan).'; });
    };
    send.addEventListener('click', go);
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } });
    var kids = [];
    if (!lsGet(LS_NAME)) kids.push(name);
    kids.push(ta, err, h('div', { class: 'rsc-fr' }, [opts.cancel ? h('button', { type: 'button', class: 'rsc-btn gh', text: 'Bekor qilish', onclick: opts.cancel }) : null, send]));
    var f = h('div', { class: 'rsc-form' }, kids);
    setTimeout(function () { (lsGet(LS_NAME) ? ta : name).focus(); }, 30);
    return f;
  }
  function draftPop() {
    var d = S.draft;
    return h('div', { class: 'rsc-pop', 'data-for': '__draft' }, [
      h('div', { class: 'rsc-ph' }, [h('span', {}, [h('b', { text: 'Yangi izoh' }), document.createTextNode(' · ' + d.screenLabel)])]),
      d.where ? h('div', { class: 'rsc-where' }, [document.createTextNode('📍 ' + d.where), d.ctx ? h('small', { text: '🗂 ' + d.ctx }) : null]) : null,
      d.quote ? h('div', { class: 'rsc-quote', text: '“' + d.quote + '”' }) : null,
      form({ ph: 'Izohingizni yozing…  (Ctrl+Enter — yuborish)', btn: 'Yuborish', cancel: function () { S.draft = null; build(); },
        submit: function (nm, t) { var body = Object.assign({}, d, { author: nm, text: t }); delete body._shot; return api('POST', body).then(function (j) { S.list.push(j.comment); S.draft = null; S.open = j.comment.id; saveShot(j.comment, d._shot); build(); }); } })
    ]);
  }
  function threadPop(c) {
    var rs = replies(c.id);
    var acts = h('div', { class: 'rsc-acts' }, [
      h('button', { type: 'button', class: 'rsc-ib', title: c.resolved ? 'Qayta ochish' : 'Hal qilindi', 'aria-label': c.resolved ? 'Qayta ochish' : 'Hal qilindi', html: c.resolved ? IC.undo : IC.check,
        onclick: function () { api('PATCH', { id: c.id, resolved: !c.resolved }).then(function (j) { Object.assign(c, j.comment); if (c.resolved) S.open = null; build(); }); } }),
      h('button', { type: 'button', class: 'rsc-ib', title: 'O\'chirish', 'aria-label': 'Izohni o\'chirish', html: IC.trash,
        onclick: function () { if (!window.confirm('Izoh va unga yozilgan javoblar o\'chirilsinmi?')) return; api('DELETE', { id: c.id }).then(function () { S.list = S.list.filter(function (x) { return x.id !== c.id && x.parent !== c.id; }); S.open = null; build(); }); } }),
      h('button', { type: 'button', class: 'rsc-ib', title: 'Yopish', 'aria-label': 'Yopish', html: IC.x, onclick: function () { S.open = null; build(); } })
    ]);
    var th = h('div', { class: 'rsc-thread' }, [msgEl(c)].concat(rs.map(msgEl)));
    return h('div', { class: 'rsc-pop', 'data-for': c.id, role: 'dialog', 'aria-label': 'Izoh ' + numOf(c) }, [
      h('div', { class: 'rsc-ph' }, [h('span', {}, [h('b', { text: '#' + numOf(c) }), document.createTextNode(' · ' + (c.resolved ? 'Hal qilingan' : c.screenLabel))]), acts]),
      h('div', { class: 'rsc-miss' }, [h('b', { text: 'Bu joy hozir ekranda ko\'rinmayapti' }), document.createTextNode('Izoh ochilib-yopiladigan menyu, oyna yoki forma ichida yozilgan' + (c.ctx || c.where ? ': ' : '.')), (c.ctx || c.where) ? h('em', { text: c.ctx || c.where }) : null, document.createTextNode(c.steps && c.steps.length ? ' «Joyni ochish» tugmasi uni avtomatik ochib beradi (ro\'yxatdan bosganda ham o\'zi ochiladi).' : (c.shot ? ' Skrinshotda qayerda yozilganini ko\'rasiz; o\'sha joyni ochsangiz belgi paydo bo\'ladi.' : ' O\'sha joyni oching — izoh belgisi avtomatik o\'sha yerda paydo bo\'ladi.'))]),
      c.where ? h('div', { class: 'rsc-where' }, [document.createTextNode('📍 ' + c.where), c.ctx ? h('small', { text: '🗂 ' + c.ctx }) : null]) : null,
      c.quote ? h('div', { class: 'rsc-quote', text: '“' + c.quote + '”' }) : null,
      (c.shot || SHOT[c.id] || (c.steps && c.steps.length)) ? h('div', { class: 'rsc-ctx' }, [
        c.shot ? h('button', { type: 'button', class: 'rsc-thumb', title: 'Izoh yozilgan paytdagi ekran', 'aria-label': 'Skrinshotni kattalashtirish', onclick: function () { lightbox(c); } }, [h('img', { src: shotUrl(c), alt: '', loading: 'lazy' }), h('span', { html: IC.cam + 'Skrinshot' })])
          : SHOT[c.id] ? h('span', { class: 'rsc-thumb wait', text: 'Skrinshot saqlanmoqda…' }) : null,
        (c.steps && c.steps.length) ? h('div', { class: 'rsc-cbox' }, [
          h('button', { type: 'button', class: 'rsc-btn pri rsc-play', html: IC.play + 'Joyni ochish', title: 'Sahifani qayta yuklab, izoh yozilgan menyu/oynani avtomatik ochadi', onclick: function () { startReplay(c); } }),
          h('details', { class: 'rsc-steps' }, [h('summary', { text: c.steps.length + ' ta qadam' }), h('ol', {}, c.steps.map(function (st) { return h('li', { text: st.label || st.fp || st.tag }); }))])
        ]) : null
      ]) : null,
      S.rpFail && S.rpFail.id === c.id ? h('div', { class: 'rsc-err rsc-rpf', text: 'Joyni avtomatik ochib bo\'lmadi (' + (S.rpFail.at + 1) + '-qadamda element topilmadi). Skrinshot va qadamlar bo\'yicha qo\'lda oching.' }) : null,
      th,
      form({ ph: 'Javob yozing…', btn: 'Javob berish', submit: function (nm, t) { return api('POST', { parent: c.id, author: nm, text: t, screen: c.screen }).then(function (j) { S.list.push(j.comment); build(); }); } })
    ]);
  }
  function buildPanel() {
    var all = roots(), curKey = screen().key;
    var counts = { open: all.filter(function (c) { return !c.resolved; }).length, res: all.filter(function (c) { return c.resolved; }).length, all: all.length };
    var q = S.q.toLowerCase();
    var items = all.filter(function (c) {
      if (S.tab === 'open' && c.resolved) return false; if (S.tab === 'res' && !c.resolved) return false;
      if (S.scr === 'here' && c.screen !== curKey) return false;
      if (q && (c.text + ' ' + c.author + ' ' + (c.where || '') + ' ' + (c.ctx || '') + ' ' + (c.quote || '') + ' ' + c.screenLabel + ' ' + replies(c.id).map(function (x) { return x.text; }).join(' ')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    // ekran bo'yicha guruhlash (joriy ekran birinchi)
    var groups = {}, order = [];
    items.slice().reverse().forEach(function (c) { if (!groups[c.screen]) { groups[c.screen] = { label: c.screenLabel || c.screen, list: [] }; order.push(c.screen); } groups[c.screen].list.push(c); });
    order.sort(function (a, b) { return (b === curKey) - (a === curKey); });
    var body = [];
    order.forEach(function (k) {
      var g = groups[k];
      body.push(h('div', { class: 'rsc-gh' }, [h('span', { text: g.label }), k === curKey ? h('em', { text: 'shu ekran' }) : null, h('small', { text: String(g.list.length) })]));
      g.list.forEach(function (c) {
        var n = replies(c.id).length;
        body.push(h('button', { type: 'button', class: 'rsc-li' + (c.resolved ? ' res' : '') + (S.open === c.id ? ' act' : ''), onclick: function () { goTo(c); } }, [
          h('span', { class: 'rsc-num', text: String(numOf(c)) }),
          h('span', { class: 'rsc-mb' }, [
            h('span', { class: 'rsc-mh' }, [h('b', { text: c.author }), h('small', { text: ago(c.at) }), c.resolved ? h('small', { class: 'rsc-ok', text: '✓ hal qilingan' }) : null]),
            h('span', { class: 'rsc-mt', text: c.text }),
            c.quote ? h('span', { class: 'rsc-q', text: '“' + c.quote + '”' }) : null,
            c.where ? h('span', { class: 'rsc-scr', text: '📍 ' + c.where }) : null,
            c.ctx ? h('span', { class: 'rsc-scr', text: '🗂 ' + c.ctx }) : null,
            c.screen === curKey && !findEl(c) ? h('span', { class: 'rsc-hid', text: 'Yopiq menyu/oyna ichida' }) : null,
            c.shot ? h('span', { class: 'rsc-scr', text: '📷 skrinshot bor' + (c.steps && c.steps.length ? ' · ▶ joyni ochish mumkin' : '') }) : null,
            n ? h('span', { class: 'rsc-scr', text: '💬 ' + n + ' ta javob' }) : null
          ])
        ]));
      });
    });
    if (!body.length) body.push(h('div', { class: 'rsc-empty', text: all.length ? 'Filtrga mos izoh topilmadi' : 'Hali izoh yo\'q. «Izoh» tugmasini bosib, sahifaning istalgan joyiga izoh qoldiring.' }));
    var tab = function (k, l) { return h('button', { type: 'button', class: 'rsc-tab' + (S.tab === k ? ' on' : ''), text: l, onclick: function () { S.tab = k; build(); } }); };
    var search = h('input', { type: 'search', class: 'rsc-search', placeholder: 'Izohlardan qidirish…', value: S.q, 'aria-label': 'Izohlardan qidirish' });
    search.addEventListener('input', function () { S.q = search.value; var pos = search.selectionStart; build(); var ns = panel && panel.querySelector('.rsc-search'); if (ns) { ns.focus(); try { ns.setSelectionRange(pos, pos); } catch (e) {} } });
    var scrSel = h('select', { class: 'rsc-scrsel', 'aria-label': 'Ekran bo\'yicha' }, [h('option', { value: 'all', text: 'Barcha ekranlar' }), h('option', { value: 'here', text: 'Faqat shu ekran' })]);
    scrSel.value = S.scr; scrSel.addEventListener('change', function () { S.scr = scrSel.value; build(); });
    return h('aside', { class: 'rsc-panel', 'aria-label': 'Izohlar ro\'yxati' }, [
      h('div', { class: 'rsc-pnh' }, [h('b', { text: 'Izohlar' }), h('span', { class: 'rsc-acts' }, [
        h('a', { class: 'rsc-ib', href: 'izohlar.html', target: '_blank', rel: 'noopener', title: 'Jadval ko\'rinishida ochish', 'aria-label': 'Jadval ko\'rinishida ochish', html: IC.table }),
        h('button', { type: 'button', class: 'rsc-ib', 'aria-label': 'Yopish', html: IC.x, onclick: function () { S.panel = false; build(); } })])]),
      !S.configured ? h('div', { class: 'rsc-banner', text: 'Izohlar xizmati hali sozlanmagan: Vercel loyihasiga Upstash Redis ulanishi kerak (README.md ga qarang).' }) : null,
      h('div', { class: 'rsc-tools' }, [search, scrSel]),
      h('div', { class: 'rsc-tabs' }, [tab('open', 'Ochiq · ' + counts.open), tab('res', 'Hal qilingan · ' + counts.res), tab('all', 'Barchasi · ' + counts.all)]),
      h('div', { class: 'rsc-list' }, body)
    ]);
  }

  // ---------- skrinshot (izoh yozilgan paytdagi ekran) ----------
  var MSP = null, SHOT = {};
  function loadMS() {
    if (window.modernScreenshot) return Promise.resolve();
    if (!MSP) MSP = new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = 'vendor/modern-screenshot.js'; sc.onload = res; sc.onerror = function () { MSP = null; rej(new Error('load')); }; document.head.appendChild(sc); });
    return MSP;
  }
  function capture(mark) {
    return loadMS().then(function () {
      var W = window.innerWidth, H = window.innerHeight, sx = window.scrollX, sy = window.scrollY, tagged = [];
      var all = document.body.getElementsByTagName('*');
      for (var i = 0; i < all.length; i++) {
        var el = all[i]; if (root.contains(el)) continue;
        var pos = getComputedStyle(el).position, dx = 0, dy = 0;
        if (pos === 'fixed') { dx = sx; dy = sy; }
        else if (pos === 'sticky') {
          var r1 = el.getBoundingClientRect(), ov = el.style.getPropertyValue('position'), op = el.style.getPropertyPriority('position');
          el.style.setProperty('position', 'relative', 'important'); var r0 = el.getBoundingClientRect();
          if (ov) el.style.setProperty('position', ov, op); else el.style.removeProperty('position');
          dx = r1.left - r0.left; dy = r1.top - r0.top;
        } else continue;
        if (dx || dy) { el.setAttribute('data-rsc-sh', dx + ' ' + dy); tagged.push(el); }
      }
      var sc = Math.min(.75, 1100 / W);
      var done = function () { tagged.forEach(function (t) { t.removeAttribute('data-rsc-sh'); }); };
      return window.modernScreenshot.domToCanvas(document.documentElement, {
        scale: sc, width: W, height: H, backgroundColor: getComputedStyle(document.body).backgroundColor || '#fff',
        style: { transform: 'translate(' + (-sx) + 'px,' + (-sy) + 'px)' },
        filter: function (n) { return !(n.classList && n.classList.contains('rsc-root')); },
        onCloneEachNode: function (n) { if (n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-rsc-sh')) { var v = n.getAttribute('data-rsc-sh').split(' '); n.style.translate = v[0] + 'px ' + v[1] + 'px'; n.removeAttribute('data-rsc-sh'); } },
        timeout: 20000
      }).then(function (cv) {
        done();
        var x = cv.getContext('2d'), k = cv.width / W;
        if (mark && mark.rect) { var m = mark.rect; x.lineWidth = 3; x.strokeStyle = '#2563eb'; x.fillStyle = 'rgba(37,99,235,.10)'; x.beginPath(); if (x.roundRect) x.roundRect((m.l - 3) * k, (m.t - 3) * k, (m.w + 6) * k, (m.h + 6) * k, 6); else x.rect((m.l - 3) * k, (m.t - 3) * k, (m.w + 6) * k, (m.h + 6) * k); x.fill(); x.stroke(); }
        if (mark && mark.x != null) { var px = mark.x * k, py = mark.y * k; x.beginPath(); x.arc(px, py, 11, 0, Math.PI * 2); x.fillStyle = '#f59e0b'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); }
        return cv.toDataURL('image/jpeg', .72);
      }, function (e) { done(); throw e; });
    });
  }
  function startShot(d, el, x, y) {
    var rc = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    d._shot = capture({ rect: rc ? { l: rc.left, t: rc.top, w: rc.width, h: rc.height } : null, x: x, y: y }).catch(function () { return null; });
  }
  function saveShot(c, p) {
    if (!p) return;
    SHOT[c.id] = 'saving'; build();
    p.then(function (img) {
      if (!img || img.length > 900000) { delete SHOT[c.id]; build(); return; }
      return api('POST', { action: 'shot', id: c.id, img: img }).then(function () { c.shot = true; delete SHOT[c.id]; build(); });
    }).catch(function () { delete SHOT[c.id]; build(); });
  }
  function shotUrl(c) { return API + '?shot=' + encodeURIComponent(c.id); }
  function lightbox(c) {
    var bx = h('div', { class: 'rsc-lb', role: 'dialog', 'aria-label': 'Skrinshot', onclick: function () { bx.remove(); } }, [
      h('div', { class: 'rsc-lbin', onclick: function (e) { e.stopPropagation(); } }, [
        h('div', { class: 'rsc-lbh' }, [h('b', { text: '#' + numOf(c) + ' · ' + (c.screenLabel || '') }), h('small', { text: 'Izoh yozilgan paytdagi ekran — sariq nuqta izoh joyi' }),
          h('button', { type: 'button', class: 'rsc-ib', 'aria-label': 'Yopish', html: IC.x, onclick: function () { bx.remove(); } })]),
        h('img', { src: shotUrl(c), alt: 'Izoh yozilgan joy skrinshoti' })
      ])]);
    root.appendChild(bx);
  }

  // ---------- qadamlar: ekranda qilingan bosishlarni eslab qolamiz (yopiq menyuni qayta ochish uchun) ----------
  var ACT = [], actKey = '';
  function actPush(o) { var k = screen().key; if (k !== actKey) { ACT = []; actKey = k; } ACT.push(o); if (ACT.length > 30) ACT.shift(); }
  document.addEventListener('click', function (e) {
    if (S.mode || !e.isTrusted || inUi(e.target) || replaying) return;
    var t = e.target.closest && e.target.closest('button,a,[role=option],[role=tab],[role=menuitem],[role=checkbox],[role=radio],[role=switch],label,summary,[tabindex]') || e.target;
    if (!t || t === document.body || t.matches('input:not([type=checkbox]):not([type=radio]),textarea,select')) return;
    actPush({ sel: selOf(t), fp: tc(t), tag: t.tagName.toLowerCase(), label: describe(t) });
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !e.isTrusted || inUi(t) || replaying || t.tagName !== 'SELECT') return;
    actPush({ kind: 'select', sel: selOf(t), fp: '', tag: 'select', value: t.value, label: describe(t) + ' = ' + ((t.selectedOptions && t.selectedOptions[0] && t.selectedOptions[0].textContent) || t.value).trim() });
  }, true);
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !e.isTrusted || inUi(t) || replaying) return;
    if (!(t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|search|number|tel|email|)$/.test(t.type || '')))) return;
    var sel = selOf(t), last = ACT[ACT.length - 1], v = String(t.value || '').slice(0, 200);
    if (last && last.kind === 'input' && last.sel === sel && screen().key === actKey) { last.value = v; last.label = (t.getAttribute('aria-label') || t.placeholder || 'Matn') + ' = ' + v; return; }
    actPush({ kind: 'input', sel: sel, fp: '', tag: t.tagName.toLowerCase(), value: v, label: (t.getAttribute('aria-label') || t.placeholder || 'Matn') + ' = ' + v });
  }, true);
  function stepsNow() { return screen().key === actKey ? ACT.slice() : []; }

  var replaying = false, rpMsg = null;
  function rpShow(t) { if (!rpMsg) { rpMsg = h('div', { class: 'rsc-hint rsc-rp' }); root.appendChild(rpMsg); } rpMsg.textContent = t; }
  function rpHide() { if (rpMsg) { rpMsg.remove(); rpMsg = null; } }
  function waitEl(st, ms) {
    return new Promise(function (res) { var t0 = Date.now(); (function tick() { var el = findEl(st); if (el) return res(el); if (Date.now() - t0 > ms) return res(null); setTimeout(tick, 120); })(); });
  }
  // animatsiyalar (chiqib ketayotgan nusxalar) tugashini kutamiz — aks holda element manzili siljiydi
  function settle() {
    return new Promise(function (res) { var t0 = Date.now(); (function tick() { if (!document.querySelector('[data-ghost]') || Date.now() - t0 > 1500) return setTimeout(res, 120); setTimeout(tick, 80); })(); });
  }
  function replay(c) {
    var steps = (c.steps || []).map(function (st, i) { return Object.assign({ _k: 'rp' + i + c.id }, st); });
    replaying = true; S.open = null; build();
    var i = 0;
    (function next() {
      if (i >= steps.length) return finish(true);
      rpShow('Izoh joyi ochilmoqda… ' + (i + 1) + ' / ' + steps.length + ' — ' + (steps[i].label || ''));
      settle().then(function () { return waitEl(steps[i], 3000); }).then(function (el) {
        if (!el) return finish(false, i);
        try {
          el.scrollIntoView({ block: 'center' });
          if (steps[i].kind === 'input') { var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, steps[i].value || ''); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
          else if (steps[i].kind === 'select') { var setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(el, steps[i].value); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
          else el.click();
        } catch (e) {}
        i++; setTimeout(next, 500);
      });
    })();
    function finish(ok, at) {
      setTimeout(function () {
        replaying = false; rpHide();
        S.open = c.id; S.rpFail = ok || anchorPos(c) ? null : { id: c.id, at: at };
        build(); reveal(c);
      }, 350);
    }
  }
  function startReplay(c) {
    lsSet(LS_REPLAY, c.id);
    // Devonxona qoralamasi bo'lsa, qadamlar toza formadan boshlanishi uchun vaqtincha zaxiraga olamiz
    var dr = lsGet('adolat.dx.draft.v3'); if (dr && c.screen === 'devon') { lsSet('adolat.dx.draft.backup', dr); lsSet('adolat.dx.draft.v3', null); }
    var cur = nav(); if (c.nav) lsSet('adolat.nav', JSON.stringify(Object.assign({}, cur, c.nav)));
    lsSet('adolat.navScroll', null); window.location.reload();
  }

  // izohga o'tish: boshqa ekranda bo'lsa — ilova holatini yozib, sahifani qayta yuklaymiz (ilova o'sha joyni tiklaydi)
  function goTo(c) {
    var hasSteps = c.steps && c.steps.length;
    if (c.screen === screen().key && (findEl(c) || !hasSteps)) { S.open = c.id; S.panel = window.innerWidth > 1100 ? S.panel : false; build(); reveal(c); return; }
    if (hasSteps) { startReplay(c); return; }
    if (c.nav) { var cur = nav(); lsSet('adolat.nav', JSON.stringify(Object.assign({}, cur, c.nav))); lsSet('adolat.navScroll', null); lsSet(LS_OPEN, c.id); window.location.reload(); }
  }
  function reveal(c) {
    try { var el = findEl(c); if (!el) return; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); S.flash = { el: el, until: Date.now() + 2600 }; } catch (e) {}
  }
  function afterLoad() {
    var qs = (location.search.match(/[?&]c=([\w-]+)/) || [])[1];
    var play = /[?&]play=1/.test(location.search);
    if (qs) { history.replaceState(null, '', location.pathname); var qc = S.list.filter(function (x) { return x.id === qs; })[0]; if (qc && qc.steps && qc.steps.length && (play || qc.screen !== screen().key)) { startReplay(qc); return; } if (qc) { if (qc.screen !== screen().key) { goTo(qc); return; } lsSet(LS_OPEN, qc.id); } }
    var rp = lsGet(LS_REPLAY); if (rp) { lsSet(LS_REPLAY, null); lsSet(LS_OPEN, null); var rc = S.list.filter(function (x) { return x.id === rp; })[0]; if (rc) { setTimeout(function () { replay(rc); }, 900); return; } }
    var id = lsGet(LS_OPEN); if (!id) return; lsSet(LS_OPEN, null);
    var c = S.list.filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var tries = 0; (function wait() { if (anchorPos(c) || tries++ > 25) { S.open = c.id; build(); reveal(c); return; } setTimeout(wait, 200); })();
  }

  // ---------- joylashtirish (har kadrda) ----------
  function position() {
    var scr = screen();
    Array.prototype.forEach.call(layer.querySelectorAll('.rsc-pin'), function (pin) {
      var id = pin.getAttribute('data-id'), c = id === '__draft' ? S.draft : S.list.filter(function (x) { return x.id === id; })[0];
      var p = c && anchorPos(c);
      if (!p || p.off) { pin.style.display = 'none'; return; }
      pin.style.display = ''; pin.style.left = p.x + 'px'; pin.style.top = p.y + 'px';
    });
    var pop = layer.querySelector('.rsc-pop');
    if (pop) {
      var fid = pop.getAttribute('data-for'), fc = fid === '__draft' ? S.draft : S.list.filter(function (x) { return x.id === fid; })[0];
      var q = fc && anchorPos(fc);
      if (!q || q.off && fid === '__draft') {
        if (fid === '__draft') { pop.style.display = 'none'; }
        else { pop.style.display = ''; pop.classList.add('miss'); var pw = pop.offsetWidth || 320, ph2 = pop.offsetHeight || 200;
          pop.style.left = Math.max(12, window.innerWidth - pw - (S.panel && window.innerWidth > 760 ? 420 : 60)) + 'px'; pop.style.top = Math.max(12, window.innerHeight - ph2 - 20) + 'px'; }
      } else {
        pop.style.display = ''; pop.classList.remove('miss');
        var w = pop.offsetWidth || 320, hh = pop.offsetHeight || 200;
        var x = q.x + 20, y = q.y - 30;
        if (x + w > window.innerWidth - 12) x = q.x - w - 20;
        if (x < 12) x = 12;
        if (y + hh > window.innerHeight - 12) y = window.innerHeight - hh - 12;
        if (y < 12) y = 12;
        pop.style.left = x + 'px'; pop.style.top = y + 'px';
      }
    }
    // komponent tanlash ramkasi
    if (S.mode && HOV.el && HOV.el.isConnected) {
      var hr = HOV.el.getBoundingClientRect(); hbox.style.display = 'block';
      hbox.style.left = hr.left + 'px'; hbox.style.top = hr.top + 'px'; hbox.style.width = hr.width + 'px'; hbox.style.height = hr.height + 'px';
      hbox.classList.toggle('below', hr.top < 28);
    } else hbox.style.display = 'none';
    // ochiq izohning elementi
    var ac = S.draft || (S.open && S.list.filter(function (x) { return x.id === S.open; })[0]), ae = null;
    if (ac) ae = findEl(ac);
    var ar = ae && ae.getBoundingClientRect();
    if (ar && ar.width) { abox.style.display = 'block'; abox.style.left = (ar.left - 3) + 'px'; abox.style.top = (ar.top - 3) + 'px'; abox.style.width = (ar.width + 6) + 'px'; abox.style.height = (ar.height + 6) + 'px'; }
    else abox.style.display = 'none';
    // matn belgilash tugmasi
    if (SEL && !S.draft && !S.mode) {
      var rr = SEL.range.getClientRects(), last = rr.length ? rr[rr.length - 1] : SEL.range.getBoundingClientRect();
      if (last && (last.width || last.height)) { selBtn.style.display = 'inline-flex'; selBtn.style.left = Math.min(window.innerWidth - 150, last.right + 6) + 'px'; selBtn.style.top = Math.min(window.innerHeight - 44, last.bottom + 6) + 'px'; }
      else selBtn.style.display = 'none';
    } else selBtn.style.display = 'none';
    var fl = layer.querySelector('.rsc-flash');
    if (S.flash && Date.now() < S.flash.until) {
      var fe = S.flash.el && S.flash.el.isConnected ? S.flash.el : null;
      var fr = fe && fe.getBoundingClientRect();
      if (fr && fr.width) { if (!fl) { fl = h('div', { class: 'rsc-flash' }); layer.insertBefore(fl, layer.firstChild); } fl.style.left = (fr.left - 4) + 'px'; fl.style.top = (fr.top - 4) + 'px'; fl.style.width = (fr.width + 8) + 'px'; fl.style.height = (fr.height + 8) + 'px'; }
    } else if (fl) { fl.remove(); S.flash = null; }
    if (scr.key !== lastKey) { lastKey = scr.key; if (!S.draft) build(); }
  }
  var lastKey = '';
  (function loop() { try { position(); } catch (e) {} window.requestAnimationFrame(loop); })();

  // ---------- izoh rejimida bosishni ushlab qolish ----------
  function inUi(t) { return root.contains(t); }
  function block(e) { if (!S.mode || inUi(e.target)) return; e.preventDefault(); e.stopPropagation(); }
  ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'dblclick', 'contextmenu'].forEach(function (ev) { document.addEventListener(ev, block, true); });
  document.addEventListener('click', function (e) {
    if (!S.mode || inUi(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    var el = HOV.el || pick(e.clientX, e.clientY) || e.target; if (!el || el === document.documentElement || el === document.body) return;
    var r = el.getBoundingClientRect(), scr = screen(), cl = function (v) { return Math.max(0, Math.min(1, v)); };
    S.draft = { kind: 'element', where: describe(el), ctx: ctxOf(el), fp: tc(el), tag: el.tagName.toLowerCase(), sel: selOf(el), rx: r.width ? cl((e.clientX - r.left) / r.width) : 0, ry: r.height ? cl((e.clientY - r.top) / r.height) : 0, px: e.pageX, py: e.pageY, screen: scr.key, screenLabel: scr.label, nav: scr.nav };
    S.draft.steps = stepsNow(); startShot(S.draft, el, e.clientX, e.clientY);
    S.mode = false; document.documentElement.classList.remove('rsc-mode');
    build();
  }, true);
  document.addEventListener('mousemove', function (e) {
    if (!S.mode || inUi(e.target)) return;
    var t = pick(e.clientX, e.clientY) || e.target;
    if (t !== HOV.base) setHover(t, autoUp(t));
  }, true);
  // matnni belgilab izoh qoldirish
  selBtn.innerHTML = IC.chat; selBtn.appendChild(document.createTextNode('Izoh'));
  selBtn.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
  selBtn.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation(); if (!SEL) return;
    var node = SEL.range.commonAncestorContainer, el = node.nodeType === 1 ? node : node.parentElement;
    var rr = SEL.range.getClientRects(), last = rr.length ? rr[rr.length - 1] : SEL.range.getBoundingClientRect(), r = el.getBoundingClientRect(), scr = screen();
    var cl = function (v) { return Math.max(0, Math.min(1, v)); };
    S.draft = { kind: 'text', quote: SEL.text.slice(0, 500), where: describe(el), ctx: ctxOf(el), fp: tc(el), tag: el.tagName.toLowerCase(), sel: selOf(el), rx: r.width ? cl((last.right - r.left) / r.width) : 0, ry: r.height ? cl((last.top - r.top) / r.height) : 0, px: 0, py: 0, screen: scr.key, screenLabel: scr.label, nav: scr.nav };
    S.draft.steps = stepsNow(); var srect = SEL.range.getBoundingClientRect(); S.draft._shot = capture({ rect: { l: srect.left, t: srect.top, w: srect.width, h: srect.height }, x: last.right, y: last.top }).catch(function () { return null; });
    S.open = null; build();
  });
  function checkSel() {
    if (S.mode || S.draft) return;
    var sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { SEL = null; return; }
    var rg = sel.getRangeAt(0), anc = rg.commonAncestorContainer, ancEl = anc.nodeType === 1 ? anc : anc.parentElement;
    if (!ancEl || inUi(ancEl) || ancEl.closest('input,textarea,[contenteditable="true"]')) { SEL = null; return; }
    var t = sel.toString().replace(/\s+/g, ' ').trim();
    if (!t || t.length > 1000) { SEL = null; return; }
    SEL = { range: rg.cloneRange(), text: sel.toString().trim() };
  }
  document.addEventListener('mouseup', function (e) { if (!inUi(e.target)) setTimeout(checkSel, 10); });
  document.addEventListener('keyup', function (e) { if (e.shiftKey || e.key === 'Shift') setTimeout(checkSel, 10); });
  document.addEventListener('selectionchange', function () { var sel = window.getSelection(); if (SEL && (!sel || sel.isCollapsed)) { SEL = null; if (S.draft && S.draft.kind === 'text') markQuote(); } });
  document.addEventListener('keydown', function (e) {
    if (S.mode && HOV.base && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); e.stopPropagation(); setHover(HOV.base, HOV.up + (e.key === 'ArrowUp' ? 1 : -1)); return; }
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === 'Escape' && root.querySelector('.rsc-lb')) { root.querySelector('.rsc-lb').remove(); e.stopPropagation(); return; }
    if (e.key === 'Escape') { if (S.mode) { setMode(false); e.stopPropagation(); } else if (S.draft || S.open) { S.draft = null; S.open = null; build(); e.stopPropagation(); } else if (S.panel) { S.panel = false; build(); } return; }
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'c' || e.key === 'C') && !S.draft) { setMode(!S.mode); }
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'l' || e.key === 'L')) { S.panel = !S.panel; build(); }
  }, true);

  // ---------- ishga tushirish ----------
  function start() {
    var css = document.querySelector('link[href$="comments.css"]');
    if (!css) document.head.appendChild(h('link', { rel: 'stylesheet', href: 'comments.css' }));
    document.body.appendChild(root); build(); load();
    setInterval(function () { var ta = layer.querySelector('textarea'); if (!document.hidden && !S.draft && !(ta && (ta.value || document.activeElement === ta))) load(); }, 15000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
