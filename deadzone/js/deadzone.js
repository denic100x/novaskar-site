/* ==========================================================
   NS-DEADZONE — скрипты раздела
   Статусы серверов и онлайн, таймер нашествия, локации,
   плитки, новости, «Возможности», правила, лаунчер, донат, Discord.
   Настройки — в ../js/config.js (блок deadzone), тексты — в dz-data.js.
   ========================================================== */
(function () {
  "use strict";

  var S = window.SITE || {};
  var C = S.deadzone || {};
  var D = window.DZ || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  };
  var BASE = document.documentElement.getAttribute("data-base") || (location.pathname.indexOf("/deadzone/") > -1 ? "../" : "");
  var ARROW = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15"/><path d="M13 6l6 6-6 6"/></svg>';
  var MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  function fmtDate(iso) {
    var p = String(iso || "").split("-");
    return p.length === 3 ? parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0] : (iso || "");
  }
  function fmtShort(iso) {
    var p = String(iso || "").split("-");
    return p.length === 3 ? p[2] + "." + p[1] : (iso || "");
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }) : null;

  function toast(msg) { // тот же тост, что в app.js
    if (window.NS && window.NS.toast) { window.NS.toast(msg); return; }
    var el = $(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove("show"); }, 3200);
  }

  /* ================================================================
     СТАТУСЫ СЕРВЕРОВ И ОНЛАЙН
     ================================================================ */
  var STATUS = { soon: ["На старте", "am"], online: ["Работает", "gr"], later: ["Позже", "rd"], off: ["Выключен", ""] };
  var state = {};
  (C.servers || []).forEach(function (s) { state[s.id] = { status: s.status || "soon", online: null, max: s.max || 0, address: s.address || "", discord: s.discord || "" }; });

  function renderServers() {
    var total = 0, anyOnline = false, known = false;
    Object.keys(state).forEach(function (id) {
      var st = state[id];
      var meta = STATUS[st.status] || STATUS.off;
      if (st.status === "online") { anyOnline = true; if (st.online != null) { known = true; total += st.online; } }
      $$('.js-srv[data-server="' + id + '"]').forEach(function (el) {
        el.setAttribute("data-srv", st.status);
        $$(".js-srv-badge", el).forEach(function (b) { b.className = b.className.replace(/\b(am|gr|rd|cy|go|or)\b/g, "").replace(/\s+/g, " ").trim() + (meta[1] ? " " + meta[1] : ""); b.textContent = meta[0]; });
        $$(".js-srv-online", el).forEach(function (o) {
          if (st.status === "online") {
            o.innerHTML = '<i class="dot on" aria-hidden="true"></i>' + (st.online == null ? "—" : st.online) + " / " + (st.max || "—");
            o.hidden = false;
          } else { o.hidden = true; }
        });
        $$(".js-srv-discord", el).forEach(function (a) {
          if (st.discord) { a.hidden = false; a.href = st.discord; a.target = "_blank"; a.rel = "noopener"; } else { a.hidden = true; }
        });
        $$(".js-srv-addr", el).forEach(function (a) {
          if (st.status === "online" && st.address) { a.hidden = false; $(".addr", a).textContent = st.address; } else { a.hidden = true; }
        });
      });
    });
    $$(".js-online-total").forEach(function (el) { el.textContent = anyOnline && known ? String(total) : "—"; });
    $$(".js-online-note").forEach(function (el) { el.textContent = anyOnline ? "игроков на серверах" : "серверы ещё не открыты"; });
  }

  function applyApi(data) {
    if (!data) return;
    if (data.servers) {
      Object.keys(data.servers).forEach(function (id) {
        if (!state[id]) return;
        var s = data.servers[id] || {};
        if (s.status) state[id].status = s.status;
        if (typeof s.online === "number") state[id].online = s.online;
        if (typeof s.max === "number") state[id].max = s.max;
        if (s.address) state[id].address = s.address;
      });
    }
    if (data.invasion && data.invasion.nextAt) { moonTarget = new Date(data.invasion.nextAt); }
    renderServers();
    renderMoon();
  }

  function pollApi() {
    if (!C.api || typeof fetch !== "function") return;
    fetch(String(C.api).replace(/\/$/, "") + "/status", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(applyApi)
      .catch(function () { /* сервис недоступен — оставляем данные из config */ });
  }

  /* копировать адрес сервера */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy-addr]");
    if (!b) return;
    var txt = ($(".addr", b.parentNode) || {}).textContent || "";
    if (!txt) return;
    var done = function () { toast("Адрес скопирован: " + txt); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { toast(txt); });
    else toast(txt);
  });

  /* ================================================================
     ТАЙМЕР КРОВАВОЙ ЛУНЫ
     ================================================================ */
  var moonEl = $("#moon");
  var moonTarget = C.nextInvasion ? new Date(C.nextInvasion) : null;
  var cycleMs = (C.invasionEveryDays || 7) * 86400000;

  function normTarget() {
    if (!moonTarget || isNaN(moonTarget.getTime())) return null;
    var t = moonTarget.getTime(), now = Date.now();
    while (t < now) t += cycleMs;      // дата прошла — следующее нашествие через цикл
    return t;
  }
  function renderMoon() {
    if (!moonEl) return;
    var t = normTarget();
    var timeEl = $(".js-moon-time", moonEl), barEl = $(".js-moon-bar", moonEl), noteEl = $(".js-moon-note", moonEl);
    if (!t) {
      moonEl.classList.add("is-idle");
      if (timeEl) timeEl.textContent = "— д — ч — мин";
      if (barEl) barEl.style.width = "0%";
      if (noteEl) noteEl.textContent = "Отсчёт начнётся вместе с открытием сервера ALPHA";
      return;
    }
    moonEl.classList.remove("is-idle");
    var left = t - Date.now();
    var d = Math.floor(left / 86400000), h = Math.floor(left % 86400000 / 3600000), m = Math.floor(left % 3600000 / 60000), s = Math.floor(left % 60000 / 1000);
    var txt = d > 0 ? d + " д " + h + " ч " + pad(m) + " мин" : (h > 0 ? h + " ч " + pad(m) + " мин " + pad(s) + " с" : m + " мин " + pad(s) + " с");
    if (timeEl) timeEl.textContent = txt;
    if (barEl) barEl.style.width = Math.max(2, Math.min(100, (1 - left / cycleMs) * 100)).toFixed(1) + "%";
    if (noteEl) {
      var dt = new Date(t);
      noteEl.textContent = "Ближайшее нашествие на ALPHA — " + dt.getDate() + " " + MONTHS[dt.getMonth()] + " в " + pad(dt.getHours()) + ":" + pad(dt.getMinutes()) + " (твоё время)";
    }
    if (left < 60000 && !moonEl.classList.contains("is-near")) moonEl.classList.add("is-near");
  }

  /* ================================================================
     СЕЗОН
     ================================================================ */
  if (C.season) {
    $$(".js-season-num").forEach(function (el) { el.textContent = C.season.number || 1; });
    $$(".js-season-ends").forEach(function (el) { el.textContent = C.season.ends ? "до " + fmtShort(C.season.ends) : "скоро"; });
  }
  $$(".js-moon-days").forEach(function (el) { el.textContent = C.invasionEveryDays || 7; });
  $$(".js-srv-count").forEach(function (el) { el.textContent = (C.servers || []).length || 3; });
  $$(".js-mc-version").forEach(function (el) { el.textContent = C.mcVersion || "1.21.1"; });

  /* ================================================================
     ГЛАВНАЯ: ПЛИТКИ И ЛОКАЦИИ
     ================================================================ */
  var tilesEl = $("#tiles");
  if (tilesEl && D.tiles) {
    tilesEl.innerHTML = D.tiles.map(function (t) {
      return '<a class="tile rv" href="systems#' + esc(t.anchor) + '"><span class="t-ic" aria-hidden="true">' + t.icon + "</span><b>" + esc(t.title) + "</b><p>" + esc(t.text) + "</p></a>";
    }).join("");
  }
  var locsEl = $("#locs");
  if (locsEl && D.locations) {
    locsEl.innerHTML = D.locations.map(function (l) {
      var skulls = "";
      for (var i = 1; i <= 5; i++) skulls += '<span class="' + (i <= l.danger ? "on" : "") + '">💀</span>';
      return '<article class="loc rv"><img src="' + esc(l.img) + '" alt="" width="720" height="440" loading="lazy" decoding="async"><div class="loc-body"><div class="loc-danger" aria-label="Опасность ' + l.danger + ' из 5">' + skulls + "</div><h3>" + esc(l.name) + "</h3><p>" + esc(l.text) + "</p></div></article>";
    }).join("");
    var wrap = locsEl.parentNode;
    $$("[data-scroll]", wrap).forEach(function (b) {
      b.addEventListener("click", function () { locsEl.scrollBy({ left: (parseInt(b.getAttribute("data-scroll"), 10) || 1) * 340, behavior: "smooth" }); });
    });
  }

  /* ================================================================
     НОВОСТИ
     ================================================================ */
  var NEWS = (C.news || []).map(function (n, i) { n._i = i; return n; }).sort(function (a, b) { return a.date === b.date ? a._i - b._i : (a.date < b.date ? 1 : -1); });
  function tagClass(tag) {
    return { "Обновление": "or", "Событие": "gr", "Сезон": "go", "Техработы": "rd", "Проект": "" }[tag] || "";
  }
  function newsCard(n) {
    var img = n.image || "assets/banner.jpg";
    return '<article class="ncard rv"><a class="ncard-img" href="news?id=' + encodeURIComponent(n.id || "") + '"><img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" width="800" height="280"></a>' +
      '<div class="ncard-body"><div class="meta"><span class="badge ' + tagClass(n.tag) + '">' + esc(n.tag || "Новости") + '</span><time datetime="' + esc(n.date) + '">' + esc(fmtDate(n.date)) + "</time></div>" +
      '<h3><a href="news?id=' + encodeURIComponent(n.id || "") + '">' + esc(n.title) + "</a></h3><p>" + esc(n.text) + "</p></div></article>";
  }
  var homeNews = $("#dz-news-home");
  if (homeNews) homeNews.innerHTML = NEWS.slice(0, 3).map(newsCard).join("") || '<div class="no-results">Новостей пока нет.</div>';

  var newsRoot = $("#dz-news");
  if (newsRoot) {
    var params = new URLSearchParams(location.search);
    var one = params.get("id") && NEWS.filter(function (n) { return n.id === params.get("id"); })[0];
    var filterEl = $("#news-filter"), oneEl = $("#news-one"), listWrap = $("#news-list-wrap");
    if (one) {
      if (listWrap) listWrap.hidden = true;
      if (oneEl) {
        oneEl.hidden = false;
        var paras = String(one.body || one.text || "").split(/\n\s*\n/).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
        oneEl.innerHTML = '<a class="back" href="news">' + ARROW.replace('d="M4 12h15"', 'd="M20 12H5"').replace('d="M13 6l6 6-6 6"', 'd="M11 6l-6 6 6 6"') + " Все новости</a>" +
          '<div class="meta"><span class="badge ' + tagClass(one.tag) + '">' + esc(one.tag) + '</span><time datetime="' + esc(one.date) + '">' + esc(fmtDate(one.date)) + "</time></div>" +
          "<h1>" + esc(one.title) + "</h1>" + (one.image ? '<img class="one-img" src="' + esc(one.image) + '" alt="">' : "") + '<div class="one-body">' + paras + "</div>";
        document.title = one.title + " — NS-Deadzone";
      }
    } else {
      var tags = []; NEWS.forEach(function (n) { if (n.tag && tags.indexOf(n.tag) < 0) tags.push(n.tag); });
      if (filterEl) {
        filterEl.innerHTML = '<button class="tab" data-tag="" aria-selected="true">Все <span class="n">' + NEWS.length + "</span></button>" + tags.map(function (t) {
          return '<button class="tab" data-tag="' + esc(t) + '" aria-selected="false">' + esc(t) + "</button>";
        }).join("");
        filterEl.addEventListener("click", function (e) {
          var b = e.target.closest(".tab"); if (!b) return;
          $$(".tab", filterEl).forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
          renderNews(b.getAttribute("data-tag"));
        });
      }
      var renderNews = function (tag) {
        var list = tag ? NEWS.filter(function (n) { return n.tag === tag; }) : NEWS;
        newsRoot.innerHTML = list.map(newsCard).join("") || '<div class="no-results">Новостей с таким тегом пока нет.</div>';
        reveal();
      };
      renderNews("");
    }
  }

  /* ================================================================
     ВОЗМОЖНОСТИ
     ================================================================ */
  var sysRoot = $("#sys-root");
  if (sysRoot && D.systems) {
    sysRoot.innerHTML = D.systems.map(function (s, i) {
      return '<section class="dzs rv" id="' + esc(s.id) + '"><div class="dzs-head"><span class="dzs-ic" aria-hidden="true">' + s.icon + '</span><div><span class="eyebrow">' + pad(i + 1) + " / " + pad(D.systems.length) + "</span><h2>" + esc(s.title) + "</h2></div></div>" +
        '<div class="dzs-grid"><div class="dzs-text">' + s.p.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>" +
        '<figure class="shot" aria-label="Скриншот появится позже"><span class="shot-ic" aria-hidden="true">' + s.icon + '</span><figcaption>Скриншот появится ближе к открытию</figcaption></figure></div>' +
        '<div class="dz-how"><b>Как это работает</b><ul class="tick">' + s.how.map(function (h) { return "<li>" + esc(h).replace(/\(([^)]{1,10})\)/g, function (m, k) { return /^[A-Z0-9]{1,3}$|^(ПКМ|ЛКМ|Shift|Ctrl|Alt|Tab)$/.test(k) ? " (<kbd>" + k + "</kbd>)" : m; }) + "</li>"; }).join("") + "</ul></div></section>";
    }).join("");
    var toc = $("#sys-toc"), sel = $("#sys-select");
    if (toc) toc.innerHTML = D.systems.map(function (s) { return '<a href="#' + esc(s.id) + '">' + s.icon + " " + esc(s.title) + "</a>"; }).join("");
    if (sel) {
      sel.innerHTML = '<option value="">Перейти к разделу…</option>' + D.systems.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.title) + "</option>"; }).join("");
      sel.addEventListener("change", function () { if (sel.value) location.hash = sel.value; sel.value = ""; });
    }
    if (toc && "IntersectionObserver" in window) {
      var links = $$("a", toc);
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle("cur", a.getAttribute("href") === "#" + en.target.id); });
        });
      }, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });
      $$(".dzs", sysRoot).forEach(function (sec) { spy.observe(sec); });
    }
  }

  /* ================================================================
     ПРАВИЛА
     ================================================================ */
  var rulesRoot = $("#rules-root");
  if (rulesRoot && D.rules) {
    var PUN = { warn: "Предупреждение", mute: "Мут", ban: "Бан", perm: "Перманент", note: "" };
    rulesRoot.innerHTML = D.rules.map(function (sec, si) {
      return '<section class="rule-sec rv" id="' + esc(sec.id) + '"><h2><span class="num">' + (si + 1) + "</span>" + esc(sec.title) + '</h2><ol class="rules">' + sec.items.map(function (r, ri) {
        return '<li><span class="r-num">' + (si + 1) + "." + (ri + 1) + '</span><span class="r-text">' + esc(r.t) + '</span><span class="pun pun-' + esc(r.pun) + '">' + esc(r.label || PUN[r.pun] || "") + "</span></li>";
      }).join("") + "</ol></section>";
    }).join("");
    var rtoc = $("#rules-toc");
    if (rtoc) rtoc.innerHTML = D.rules.map(function (s, i) { return '<a href="#' + esc(s.id) + '">' + (i + 1) + ". " + esc(s.title) + "</a>"; }).join("");
    $$(".js-rules-updated").forEach(function (el) { el.textContent = fmtDate(D.rulesUpdated); });
  }

  /* ================================================================
     ЛАУНЧЕР
     ================================================================ */
  var L = C.launcher || {}, LD = D.launcher || {};
  $$(".js-l-version").forEach(function (el) { el.textContent = L.version || "—"; });
  $$(".js-l-date").forEach(function (el) { el.textContent = L.date ? fmtDate(L.date) : "—"; });
  $$(".js-l-size").forEach(function (el) { el.textContent = L.size || "—"; });
  $$(".js-l-meta").forEach(function (el) { el.hidden = !(L.version || L.date || L.size); });
  function reqRows(rows) { return rows.map(function (r) { return "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>"; }).join(""); }
  if ($("#req-min") && LD.req) { $("#req-min").innerHTML = reqRows(LD.req.min); $("#req-rec").innerHTML = reqRows(LD.req.rec); }
  var instEl = $("#inst-steps");
  if (instEl && LD.steps) instEl.innerHTML = LD.steps.map(function (s, i) {
    return '<li class="inst rv"><span class="step-num">' + (i + 1) + "</span><div><h3>" + esc(s.title) + "</h3><p>" + esc(s.text) + '</p></div><figure class="shot shot-sm" aria-label="Скриншот появится позже"><span class="shot-ic" aria-hidden="true">🖥️</span><figcaption>Скриншот</figcaption></figure></li>';
  }).join("");
  var faqEl = $("#faq");
  if (faqEl && LD.faq) faqEl.innerHTML = LD.faq.map(function (f) {
    return '<details class="faq rv"><summary>' + esc(f.q) + '<span class="chev">›</span></summary><p>' + esc(f.a) + "</p></details>";
  }).join("");

  /* ================================================================
     ДОНАТ
     ================================================================ */
  var DN = C.donate || {}, DD = D.donate || {};
  var usd = function (n) { return "$" + String(n); };
  var fmtN = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); };
  var rate = DN.rate || 10000;
  $$(".js-rate").forEach(function (el) { el.textContent = fmtN(rate); });
  var packsEl = $("#coin-packs");
  if (packsEl) {
    packsEl.innerHTML = (DN.packs || []).map(function (p, i, arr) {
      var big = i === arr.length - 1;
      var total = (p.usd || 0) + (p.bonus || 0);
      return '<div class="pack rv' + (big ? " pack-big" : "") + '"><span class="coin" aria-hidden="true">💵</span><b>' + usd(p.usd) + '</b><span class="p-label">= ' + fmtN(total * rate) + " игровых</span>" +
        (p.bonus ? '<span class="bonus">+' + usd(p.bonus) + " в подарок</span>" : '<span class="bonus muted">без бонуса</span>') +
        '<span class="price">+' + usd(total) + ' на баланс</span><a class="btn btn-line btn-sm" href="#" data-need-login>Пополнить</a></div>';
    }).join("");
  }
  var plansEl = $("#plans");
  if (plansEl) {
    var period = "month";
    var renderPlans = function () {
      plansEl.innerHTML = (DN.statuses || []).map(function (s) {
        var price = s[period], per = period === "month" ? "/ 30 дней" : "навсегда";
        return '<div class="plan plan-' + esc(s.id) + (s.best ? " best" : "") + ' rv">' + (s.best ? '<span class="ribbon">Лучший выбор</span>' : "") +
          "<h3>" + esc(s.name) + '</h3><div class="plan-price"><b>' + usd(price) + "</b> <small>" + per + "</small></div>" +
          '<ul class="tick">' + ((DD.perks || {})[s.id] || []).map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" +
          '<a class="btn ' + (s.best ? "btn-primary" : "btn-line") + '" href="#" data-need-login>Оформить</a></div>';
      }).join("");
      reveal();
    };
    renderPlans();
    var tg = $("#bill-toggle");
    if (tg) tg.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      period = b.getAttribute("data-period");
      $$("button", tg).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      renderPlans();
    });
  }
  var cmpEl = $("#cmp-table");
  if (cmpEl && DD.compare) {
    var cell = function (v) { return v === true ? '<span class="yes">✓</span>' : v === false ? '<span class="no">—</span>' : esc(v); };
    cmpEl.innerHTML = "<thead><tr><th></th>" + (DN.statuses || []).map(function (s) { return "<th" + (s.best ? ' class="best"' : "") + ">" + esc(s.name) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      DD.compare.map(function (row) { return "<tr><th>" + esc(row[0]) + "</th>" + row.slice(1).map(function (v, i) { return "<td" + ((DN.statuses || [])[i] && DN.statuses[i].best ? ' class="best"' : "") + ">" + cell(v) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody>";
  }
  var cbEl = $("#cannot-buy");
  if (cbEl && DD.cannotBuy) cbEl.innerHTML = DD.cannotBuy.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
  $$(".js-donate-intro").forEach(function (el) { el.textContent = DD.intro || ""; });
  $$(".js-tier-note").forEach(function (el) { el.textContent = DD.tierNote || ""; });
  $$(".js-prices-note").forEach(function (el) { el.hidden = !!DN.pricesFinal; });
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-need-login]");
    if (!a) return;
    e.preventDefault();
    var logged = window.NS && window.NS.auth && window.NS.auth.get();
    if (logged) toast("Пополнение и покупка статусов NS-Deadzone откроются вместе с сервером. Баланс — общий с Mini City RP.");
    else location.href = BASE + "cabinet#donate";
  });

  /* ================================================================
     О СЕРВЕРЕ
     ================================================================ */
  var storyEl = $("#story");
  if (storyEl && D.about) storyEl.innerHTML = D.about.story.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
  var diffEl = $("#diff");
  if (diffEl && D.about) diffEl.innerHTML = D.about.diff.map(function (d) {
    return '<div class="panel rv"><span class="big-ic" aria-hidden="true">' + d.icon + "</span><h3>" + esc(d.title) + "</h3><p>" + esc(d.text) + "</p></div>";
  }).join("");
  var teamEl = $("#team");
  if (teamEl) {
    var team = C.team || [];
    teamEl.innerHTML = team.map(function (m) {
      var ini = esc(String(m.name || "?").trim().slice(0, 2).toUpperCase());
      var av = m.avatar ? '<img src="' + esc(m.avatar) + '" alt="">' : '<span class="ini">' + ini + "</span>";
      return '<div class="member rv"><div class="avatar">' + av + "</div><b>" + esc(m.name) + "</b><small>" + esc(m.role) + "</small></div>";
    }).join("") + '<div class="member member-open rv"><div class="avatar"><span class="ini">+</span></div><b>Ищем людей</b><small>Строители, модераторы, тестеры — напиши в Discord</small></div>';
  }
  var socEl = $("#socials");
  if (socEl) {
    var soc = C.socials || [];
    socEl.innerHTML = soc.length ? soc.map(function (s) { return '<a class="btn btn-line btn-sm" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + "</a>"; }).join("") : "";
    socEl.hidden = !soc.length;
  }

  /* ================================================================
     DISCORD
     ================================================================ */
  var dw = $("#discord-widget");
  var DC = C.discord || {};
  if (dw) {
    if (DC.widgetId) {
      dw.innerHTML = '<iframe src="https://discord.com/widget?id=' + encodeURIComponent(DC.widgetId) + '&theme=dark" width="100%" height="360" allowtransparency="true" frameborder="0" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts" title="Discord NS-Deadzone" loading="lazy"></iframe>';
      if (typeof fetch === "function") fetch("https://discord.com/api/guilds/" + encodeURIComponent(DC.widgetId) + "/widget.json")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && typeof j.presence_count === "number") $$(".js-discord-online").forEach(function (el) { el.textContent = j.presence_count + " онлайн"; }); })
        .catch(function () { });
    } else {
      dw.innerHTML = '<div class="dw-soon"><span aria-hidden="true">💬</span><p>Discord-сервер NS-Deadzone откроется вместе с сервером. Виджет онлайна появится здесь.</p></div>';
    }
  }

  /* ================================================================
     КАРТА И ВИКИ
     ================================================================ */
  var mapEl = $("#map-frame");
  if (mapEl) {
    if (C.map) { mapEl.innerHTML = '<iframe src="' + esc(C.map) + '" title="Карта мира NS-Deadzone" loading="lazy" allowfullscreen></iframe>'; mapEl.classList.add("has-map"); $("#map-soon") && ($("#map-soon").hidden = true); }
    else { mapEl.hidden = true; }
  }
  var wikiEl = $("#wiki-cards");
  if (wikiEl && D.wiki) {
    wikiEl.innerHTML = D.wiki.map(function (w) {
      var inner = '<span class="e" aria-hidden="true">' + w.icon + "</span><span><b>" + esc(w.title) + "</b><small>" + esc(w.text) + "</small></span>";
      return C.wiki ? '<a class="struct-item rv" href="' + esc(C.wiki) + '" target="_blank" rel="noopener">' + inner + "</a>" : '<div class="struct-item rv">' + inner + "</div>";
    }).join("");
    var wl = $("#wiki-link"); if (wl) { if (C.wiki) { wl.href = C.wiki; wl.hidden = false; } else wl.hidden = true; }
  }

  /* ================================================================
     ЗАПУСК
     ================================================================ */
  function reveal() {
    $$(".rv:not(.in)").forEach(function (el) {
      if (!("IntersectionObserver" in window)) { el.classList.add("in"); return; }
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 1.1) el.classList.add("in");
      else io.observe(el);
    });
  }

  window.NSDZ = { refresh: renderServers, state: state };
  renderServers();
  renderMoon();
  if (moonEl) setInterval(renderMoon, 1000);
  pollApi();
  if (C.api) setInterval(pollApi, 60000);
  reveal();
})();
