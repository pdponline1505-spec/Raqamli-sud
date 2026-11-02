/* Raqamli sud — izohlar qatlami (sahifaga qadaladigan izohlar, javoblar, hal qilish).
   Ma'lumotlar /api/comments orqali saqlanadi (api/comments.js). */
(function () {
  'use strict';
  var API = '/api/comments';
  var LS_NAME = 'rs.cname', LS_OPEN = 'rs.openAfter';
  var S = { list: [], mode: false, draft: null, open: null, panel: false, tab: 'open', configured: true, loaded: false, err: '' };

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
  function anchorPos(c) {
    if (!c.sel) return null;
    var el; try { el = document.querySelector(c.sel); } catch (e) { return null; }
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
  var fab = h('button', { type: 'button', class: 'rsc-fab', 'aria-pressed': 'false', title: 'Izoh qoldirish (C)', onclick: function () { setMode(!S.mode); } });
  var listBtn = h('button', { type: 'button', class: 'rsc-listbtn', title: 'Barcha izohlar', 'aria-label': 'Barcha izohlar', html: IC.list, onclick: function () { S.panel = !S.panel; build(); } });
  var hint = null, panel = null;
  root.appendChild(layer); root.appendChild(listBtn); root.appendChild(fab);

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
    fab.innerHTML = IC.chat; fab.appendChild(document.createTextNode(S.mode ? 'Joyni tanlang' : 'Izoh'));
    if (open) fab.appendChild(h('b', { text: String(open) }));
    fab.classList.toggle('on', S.mode); fab.setAttribute('aria-pressed', S.mode ? 'true' : 'false');
    if (hint) { hint.remove(); hint = null; }
    if (S.mode) { hint = h('div', { class: 'rsc-hint', text: 'Izoh qoldirmoqchi bo\'lgan joyni bosing · Esc — bekor qilish' }); root.appendChild(hint); }
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
      form({ ph: 'Izohingizni yozing…  (Ctrl+Enter — yuborish)', btn: 'Yuborish', cancel: function () { S.draft = null; build(); },
        submit: function (nm, t) { return api('POST', Object.assign({}, d, { author: nm, text: t })).then(function (j) { S.list.push(j.comment); S.draft = null; S.open = j.comment.id; build(); }); } })
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
      th,
      form({ ph: 'Javob yozing…', btn: 'Javob berish', submit: function (nm, t) { return api('POST', { parent: c.id, author: nm, text: t, screen: c.screen }).then(function (j) { S.list.push(j.comment); build(); }); } })
    ]);
  }
  function buildPanel() {
    var items = roots().filter(function (c) { return S.tab === 'open' ? !c.resolved : c.resolved; }).slice().reverse();
    var list = h('div', { class: 'rsc-list' }, items.length ? items.map(function (c) {
      var n = replies(c.id).length;
      return h('button', { type: 'button', class: 'rsc-li', onclick: function () { goTo(c); } }, [
        h('span', { class: 'rsc-av', style: 'background:' + colorOf(c.author), text: ini(c.author) }),
        h('span', { class: 'rsc-mb' }, [h('span', { class: 'rsc-mh' }, [h('b', { text: '#' + numOf(c) + ' ' + c.author }), h('small', { text: ago(c.at) })]), h('span', { class: 'rsc-mt', text: c.text }), h('span', { class: 'rsc-scr', text: c.screenLabel + (n ? ' · ' + n + ' ta javob' : '') })])
      ]);
    }) : [h('div', { class: 'rsc-empty', text: S.tab === 'open' ? 'Ochiq izohlar yo\'q' : 'Hal qilingan izohlar yo\'q' })]);
    var tab = function (k, l) { return h('button', { type: 'button', class: 'rsc-tab' + (S.tab === k ? ' on' : ''), text: l, onclick: function () { S.tab = k; build(); } }); };
    return h('aside', { class: 'rsc-panel', 'aria-label': 'Izohlar' }, [
      h('div', { class: 'rsc-pnh' }, [h('b', { text: 'Izohlar' }), h('button', { type: 'button', class: 'rsc-ib', 'aria-label': 'Yopish', html: IC.x, onclick: function () { S.panel = false; build(); } })]),
      !S.configured ? h('div', { class: 'rsc-banner', text: 'Izohlar xizmati hali sozlanmagan: Vercel loyihasiga Upstash Redis ulanishi kerak (README.md ga qarang).' }) : null,
      h('div', { class: 'rsc-tabs' }, [tab('open', 'Ochiq · ' + roots().filter(function (c) { return !c.resolved; }).length), tab('res', 'Hal qilingan · ' + roots().filter(function (c) { return c.resolved; }).length)]),
      list
    ]);
  }

  // izohga o'tish: boshqa ekranda bo'lsa — ilova holatini yozib, sahifani qayta yuklaymiz (ilova o'sha joyni tiklaydi)
  function goTo(c) {
    if (c.screen === screen().key) { S.open = c.id; S.panel = window.innerWidth > 1100 ? S.panel : false; build(); reveal(c); return; }
    if (c.nav) { var cur = nav(); lsSet('adolat.nav', JSON.stringify(Object.assign({}, cur, c.nav))); lsSet('adolat.navScroll', null); lsSet(LS_OPEN, c.id); window.location.reload(); }
  }
  function reveal(c) { try { var el = document.querySelector(c.sel); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
  function afterLoad() {
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
      if (!q) { pop.style.display = 'none'; } else {
        pop.style.display = '';
        var w = pop.offsetWidth || 320, hh = pop.offsetHeight || 200;
        var x = q.x + 20, y = q.y - 30;
        if (x + w > window.innerWidth - 12) x = q.x - w - 20;
        if (x < 12) x = 12;
        if (y + hh > window.innerHeight - 12) y = window.innerHeight - hh - 12;
        if (y < 12) y = 12;
        pop.style.left = x + 'px'; pop.style.top = y + 'px';
      }
    }
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
    var el = e.target; if (!el || el === document.documentElement || el === document.body) return;
    var r = el.getBoundingClientRect(), scr = screen();
    S.draft = { sel: selOf(el), rx: r.width ? (e.clientX - r.left) / r.width : 0, ry: r.height ? (e.clientY - r.top) / r.height : 0, px: e.pageX, py: e.pageY, screen: scr.key, screenLabel: scr.label, nav: scr.nav };
    S.mode = false; document.documentElement.classList.remove('rsc-mode');
    build();
  }, true);
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === 'Escape') { if (S.mode) { setMode(false); e.stopPropagation(); } else if (S.draft || S.open) { S.draft = null; S.open = null; build(); e.stopPropagation(); } else if (S.panel) { S.panel = false; build(); } return; }
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'c' || e.key === 'C') && !S.draft) { setMode(!S.mode); }
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
