/* ==========================================================
   NOVA SCAR — личный кабинет (17.10.2026)

   Как работает:
   - SITE.cabinet.api пустой → вход пока недоступен, можно открыть
     пример кабинета с демо-данными.
   - SITE.cabinet.api задан → вход кодом из игры:
       POST {api}/site/login   { code }   → { ok, token, profile }
       GET  {api}/site/me      (Bearer)   → { ok, profile }
       POST {api}/site/logout  { all }    → { ok }
       GET  {api}/site/status             → { ok, online, players, max }
   Формат profile — в README_САЙТ.md.
   ========================================================== */
(function () {
  "use strict";
  var NS = window.NS, S = window.SITE || {}, D = window.DONATE || {};
  if (!NS) return;
  var $ = NS.$, $$ = NS.$$, esc = NS.esc, auth = NS.auth;
  var root = $("#cab");
  if (!root) return;

  var TIERS = { vip: "VIP", premium: "PREMIUM", legend: "LEGEND" };
  var months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  function date(ts) {
    if (!ts) return "—";
    var d = new Date(ts * 1000);
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }
  function dateTime(ts) {
    if (!ts) return "—";
    var d = new Date(ts * 1000);
    return date(ts) + ", " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function money(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " $"; }
  function hours(sec) {
    var h = Math.floor((Number(sec) || 0) / 3600), m = Math.floor(((Number(sec) || 0) % 3600) / 60);
    return h + " ч " + m + " мин";
  }
  function pct(a, b) { b = Number(b) || 0; return b > 0 ? Math.max(0, Math.min(100, (Number(a) || 0) / b * 100)) : 0; }
  function ago(ts) {
    if (!ts) return "";
    var s = Math.floor(Date.now() / 1000) - ts;
    if (s < 90) return "только что";
    if (s < 3600) return Math.floor(s / 60) + " мин назад";
    if (s < 86400) return Math.floor(s / 3600) + " ч назад";
    return date(ts);
  }

  /* ---------------- пример кабинета (демо) ---------------- */
  function demoProfile() {
    var now = Math.floor(Date.now() / 1000);
    return {
      steamid: "76561190000000000", nick: "Алекс Новак", avatar: "", online: true, job: "Офицер полиции",
      playtime: 41 * 3600 + 25 * 60, level: 23, xp: 3200, xpNeed: 5400, xpTotal: 76100, title: "Житель",
      money: 18450, bank: 126300,
      donate: {
        balance: 3250, tier: "vip", tierExpires: now + 19 * 86400,
        subs: [{ name: "Диджей", expires: now + 9 * 86400 }],
        history: [
          { t: now - 2 * 86400, text: "Пополнение баланса", cents: 10000 },
          { t: now - 2 * 86400 + 600, text: "Статус VIP · 30 дней", cents: -2000 },
          { t: now - 86400, text: "Подписка «Диджей» · 30 дней", cents: -5000 },
          { t: now - 7200, text: "Промокод START", cents: 250 },
        ],
      },
      season: { name: "Первый город", ends: Math.floor(new Date("2026-12-31T23:59:00+03:00").getTime() / 1000), level: 12, xp: 640, xpNeed: 1200, premium: false },
      quests: [
        { kind: "Дневной", name: "Помощь горожанам", progress: 3, goal: 5, reward: "500 $ + 300 опыта" },
        { kind: "Дневной", name: "Разнообразие", progress: 2, goal: 2, reward: "1 000 $", done: true },
        { kind: "Недельный", name: "Рабочая неделя", progress: 4, goal: 10, reward: "5 000 $ + 900 опыта" },
      ],
      discord: { linked: false },
      passport: "MC-0418", phone: "4721",
      updated: now - 40,
    };
  }

  /* ---------------- вход ---------------- */
  function renderLogin(err) {
    var api = auth.api();
    var steps = [
      "Зайди на сервер Mini City RP.",
      S.cabinet.codeHint || "В игре открой F4 → Настройки → «Сайт и личный кабинет» и получи код.",
      "Введи 6 цифр ниже — кабинет откроется на этом устройстве.",
    ];
    root.innerHTML =
      '<div class="login-card rv">' +
      '<div class="eyebrow">Nova Scar · аккаунт игрока</div><h2>Личный кабинет</h2>' +
      "<p>Уровень, деньги, донат-баланс, статус, сезон и привязки — всё, что есть у тебя на сервере.</p>" +
      (api
        ? '<form class="code-row" id="login-form" autocomplete="off"><input id="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="000000" aria-label="Код из игры"><button class="btn btn-primary" type="submit">Войти</button></form>' +
          '<div class="login-err" id="login-err">' + esc(err || "") + "</div>" +
          '<ol class="login-steps">' + steps.map(function (t, i) { return "<li><i>" + (i + 1) + "</i><span>" + esc(t) + "</span></li>"; }).join("") + "</ol>"
        : '<div class="notice"><span>⏳</span><span><b>Вход скоро откроется.</b> Кабинет подключается к игровому серверу — войти можно будет кодом из игры, как при привязке Discord. Пока посмотри, как он будет выглядеть.</span></div>') +
      '<div class="login-alt"><span>' + (api ? "Хочешь сначала посмотреть?" : "Данные в примере ненастоящие.") + '</span><button class="btn btn-line" type="button" id="demo-btn">Открыть пример кабинета</button></div>' +
      "</div>";
    NS.reveal(root);
    $("#demo-btn").addEventListener("click", function () {
      auth.save({ demo: true, profile: demoProfile() });
      renderCabinet();
    });
    var form = $("#login-form");
    if (form) {
      var input = $("#code");
      input.addEventListener("input", function () { input.value = input.value.replace(/\D/g, "").slice(0, 6); });
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var code = input.value.trim();
        var errEl = $("#login-err");
        if (!/^\d{6}$/.test(code)) { errEl.textContent = "Код — это 6 цифр из игры."; return; }
        errEl.textContent = "Проверяем код…";
        NS.api("/site/login", { body: { code: code } }).then(function (j) {
          auth.save({ token: j.token, profile: j.profile });
          renderCabinet();
        }, function (e2) {
          var msg = e2.status === 404 || e2.message === "bad-code" ? "Код не найден или устарел. Получи новый в игре." :
            e2.status === 429 ? "Слишком много попыток. Подожди минуту." : "Не удалось связаться с сервером. Попробуй позже.";
          errEl.textContent = msg;
        });
      });
      input.focus();
    }
  }

  /* ---------------- разделы ---------------- */
  var TABS = [
    { id: "overview", e: "🏠", t: "Обзор" },
    { id: "donate", e: "💎", t: "Донат" },
    { id: "season", e: "🏆", t: "Сезон" },
    { id: "quests", e: "🎯", t: "Квесты" },
    { id: "links", e: "🔗", t: "Привязки" },
    { id: "security", e: "🔒", t: "Безопасность" },
  ];

  function tierPill(d) {
    var t = d && d.tier;
    if (!t || !TIERS[t]) return '<span class="tier-pill none">Без статуса</span>';
    return '<span class="tier-pill ' + esc(t) + '">' + TIERS[t] + "</span>";
  }
  function tierUntil(d) {
    if (!d || !d.tier) return "Статус можно купить в F4 → Донат";
    return d.tierExpires ? "до " + date(d.tierExpires) : "навсегда";
  }

  var V = {};
  V.overview = function (p) {
    var d = p.donate || {};
    return '<div class="cgrid">' +
      '<div class="ccard"><h3>Уровень и опыт <span class="badge cy">' + esc(p.title || "Новичок") + "</span></h3>" +
      '<div class="big-num">' + esc(p.level || 1) + " <small>из 500</small></div>" +
      '<div class="bar"><i style="width:' + pct(p.xp, p.xpNeed) + '%"></i></div>' +
      '<div class="sub-line">' + esc(p.xp || 0) + " / " + esc(p.xpNeed || 0) + " опыта до следующего уровня · всего " + esc(p.xpTotal || 0) + "</div></div>" +
      '<div class="ccard"><h3>Сейчас</h3><div class="kv">' +
      "<div><span>Статус</span><b>" + (p.online ? '<span class="dot on"></span> В игре' : "Не в сети" + (p.lastSeen ? " · " + esc(ago(p.lastSeen)) : "")) + "</b></div>" +
      "<div><span>Профессия</span><b>" + esc(p.online ? p.job || "—" : "—") + "</b></div>" +
      "<div><span>Время в игре</span><b>" + hours(p.playtime) + "</b></div></div></div>" +
      '<div class="ccard"><h3>Финансы</h3><div class="kv">' +
      "<div><span>Кошелёк</span><b>" + money(p.money) + "</b></div>" +
      "<div><span>Банковский счёт</span><b>" + money(p.bank) + "</b></div>" +
      "<div><span>Итого</span><b>" + money((Number(p.money) || 0) + (Number(p.bank) || 0)) + "</b></div></div></div>" +
      '<div class="ccard gold"><h3>Донат ' + tierPill(d) + "</h3>" +
      '<div class="big-num">' + NS.usd(d.balance) + " <small>на балансе</small></div>" +
      '<div class="sub-line">' + esc(tierUntil(d)) + '</div><p style="margin:14px 0 0"><a class="btn btn-gold btn-sm" href="#donate" data-tab-link="donate">Открыть донат</a></p></div>' +
      "</div>";
  };
  V.donate = function (p) {
    var d = p.donate || {};
    var subs = (d.subs || []).map(function (s) { return "<div><span>" + esc(s.name) + "</span><b>" + (s.forever ? "навсегда" : "до " + date(s.expires)) + "</b></div>"; }).join("");
    var hist = (d.history || []).map(function (h) {
      var c = Number(h.cents) || 0;
      return "<tr><td>" + esc(h.text) + "<small>" + esc(dateTime(h.t)) + '</small></td><td class="' + (c >= 0 ? "plus" : "minus") + '">' + (c >= 0 ? "+" : "−") + NS.usd(Math.abs(c)) + "</td></tr>";
    }).join("");
    return '<div class="cgrid">' +
      '<div class="ccard gold"><h3>Баланс</h3><div class="big-num">' + NS.usd(d.balance) + "</div>" +
      '<div class="sub-line">1 $ = ' + String(D.rate || 10000).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " игровых денег</div>" +
      '<p style="margin:16px 0 0;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-gold btn-sm" type="button" id="topup">Пополнить</button><a class="btn btn-line" href="donate.html">Цены и статусы</a></p></div>' +
      '<div class="ccard"><h3>Статус ' + tierPill(d) + '</h3><div class="kv"><div><span>Действует</span><b>' + esc(tierUntil(d)) + "</b></div>" +
      (subs || '<div><span>Платные профессии</span><b>нет</b></div>') + "</div></div>" +
      '<div class="ccard wide"><h3>История операций</h3>' + (hist ? '<table class="hist">' + hist + "</table>" : '<div class="empty">Операций пока нет.</div>') + "</div>" +
      "</div>";
  };
  V.season = function (p) {
    var s = p.season;
    if (!s) return '<div class="ccard"><div class="empty">Данных о сезоне пока нет.</div></div>';
    return '<div class="cgrid">' +
      '<div class="ccard wide"><h3>Сезон 1 · «' + esc(s.name || "Первый город") + '» <span class="badge ' + (s.premium ? "go" : "mu") + '">' + (s.premium ? "Премиум" : "Бесплатная ветка") + "</span></h3>" +
      '<div class="big-num">' + esc(s.level || 0) + " <small>из 50</small></div>" +
      '<div class="bar gold"><i style="width:' + pct(s.xp, s.xpNeed) + '%"></i></div>' +
      '<div class="sub-line">' + esc(s.xp || 0) + " / " + esc(s.xpNeed || 1200) + " сезонного опыта · сезон идёт до " + date(s.ends) + "</div></div>" +
      '<div class="ccard"><h3>Как качать</h3><ul class="tick"><li>10 опыта за минуту активной игры.</li><li>Весь обычный опыт идёт и в сезон.</li><li>Награды забираются в игре: F4 → «Сезоны».</li></ul></div>' +
      '<div class="ccard gold"><h3>Премиум-ветка</h3><p style="color:#e8dcc6;margin:0 0 14px">Оружие, больше денег и медицины, VIP и PREMIUM на несколько дней.</p>' +
      (s.premium ? '<span class="badge go">Открыта</span>' : '<a class="btn btn-gold btn-sm" href="donate.html">От $15</a>') + "</div>" +
      "</div>";
  };
  V.quests = function (p) {
    var q = p.quests || [];
    if (!q.length) return '<div class="ccard"><div class="empty">Активных квестов нет. Квесты обновляются в 00:00 МСК — смотри F4 → Кабинет → Квесты.</div></div>';
    return '<div class="ccard"><h3>Квесты · сброс в 00:00 МСК</h3><div class="qlist">' + q.map(function (x) {
      return '<div class="q' + (x.done ? " done" : "") + '"><span><small>' + esc(x.kind || "") + "</small><br><b>" + esc(x.name) + "</b></span>" +
        '<span class="badge ' + (x.done ? "gr" : "cy") + '">' + (x.done ? "Готово" : esc(x.progress) + " / " + esc(x.goal)) + "</span>" +
        '<div class="bar"><i style="width:' + pct(x.progress, x.goal) + '%"></i></div><small>Награда: ' + esc(x.reward || "—") + "</small></div>";
    }).join("") + '</div><p class="note-small">Награды забираются в игре: F4 → Кабинет → «Квесты».</p></div>';
  };
  V.links = function (p) {
    var dc = p.discord || {};
    var steam = p.steamid ? "https://steamcommunity.com/profiles/" + encodeURIComponent(p.steamid) : "";
    return '<div class="ccard">' +
      '<div class="link-row"><span class="li"><span class="e">🎮</span><span><b>Steam</b><small>' + esc(p.steamid || "—") + "</small></span></span>" +
      (steam ? '<a class="btn btn-line" href="' + esc(steam) + '" target="_blank" rel="noopener">Профиль Steam</a>' : "") + "</div>" +
      '<div class="link-row"><span class="li"><span class="e">💬</span><span><b>Discord</b><small>' +
      (dc.linked ? "Привязан: " + esc(dc.name || "") + (dc.username ? " (@" + esc(dc.username) + ")" : "") : "Не привязан · за первую привязку VIP на 7 дней") + "</small></span></span>" +
      (dc.linked ? '<span class="badge gr">Привязан</span>' : '<a class="btn btn-discord btn-sm" href="#" data-link="discord" data-soon="Discord скоро откроется.">Наш Discord</a>') + "</div>" +
      (dc.linked ? "" : '<p class="note-small" style="margin:6px 0 4px">Как привязать: в игре F4 → Настройки → Discord → «Получить код», затем команда <b>/привязать</b> в нашем Discord.</p>') +
      '<div class="link-row"><span class="li"><span class="e">🪪</span><span><b>Паспорт</b><small>' + esc(p.passport || "не получен — выдают в мэрии") + "</small></span></span></div>" +
      '<div class="link-row"><span class="li"><span class="e">📱</span><span><b>Телефон</b><small>' + esc(p.phone ? "номер " + p.phone : "—") + "</small></span></span></div>" +
      "</div>";
  };
  V.security = function (p, s) {
    return '<div class="cgrid">' +
      '<div class="ccard"><h3>Этот вход</h3><div class="kv"><div><span>Аккаунт</span><b>' + esc(p.nick) + "</b></div><div><span>Вход выполнен</span><b>" +
      esc(s.savedAt ? dateTime(Math.floor(s.savedAt / 1000)) : "—") + "</b></div></div>" +
      '<p style="margin:16px 0 0"><button class="btn btn-line" type="button" data-out>Выйти</button></p></div>' +
      '<div class="ccard"><h3>Все устройства</h3><p style="color:var(--muted);margin:0 0 14px">Если входил с чужого компьютера — выйди везде. Новый вход — только по коду из игры.</p>' +
      '<button class="btn btn-line" type="button" data-out-all' + (s.demo ? " disabled" : "") + ">Выйти на всех устройствах</button></div>" +
      "</div>";
  };

  /* ---------------- кабинет ---------------- */
  var current = "overview";
  function renderCabinet() {
    var s = auth.get();
    if (!s || !s.profile) { renderLogin(); return; }
    var p = s.profile;
    var h = (location.hash || "").replace("#", "");
    if (TABS.some(function (t) { return t.id === h; })) current = h;
    root.innerHTML =
      (s.demo ? '<div class="notice" style="margin-bottom:18px"><span>👀</span><span><b>Это пример кабинета.</b> Данные ненастоящие — так кабинет будет выглядеть после входа. <button class="btn btn-line" type="button" data-out style="height:32px;margin-left:6px">Выйти из примера</button></span></div>' : "") +
      '<div class="cab">' +
      '<aside class="cab-side"><div class="cab-me"><span class="ava">' + NS.avaHtml(p) + "</span><span><b>" + esc(p.nick) + "</b><br><small>" +
      (p.online ? '<span class="dot on"></span> в игре' : "не в сети") + " · ур. " + esc(p.level || 1) + "</small></span></div>" +
      '<nav class="cab-nav" role="tablist" aria-label="Разделы кабинета">' +
      TABS.map(function (t) { return '<button type="button" role="tab" data-tab="' + t.id + '" aria-selected="' + (t.id === current) + '"><span class="e">' + t.e + "</span>" + t.t + "</button>"; }).join("") +
      '<button type="button" class="out" data-out><span class="e">↩</span>Выйти</button></nav></aside>' +
      '<section class="cab-main"><div class="cab-title"><h2 id="cab-h"></h2><span class="upd" id="cab-upd"></span></div><div id="cab-body"></div></section>' +
      "</div>";
    $$("[data-tab]", root).forEach(function (b) { b.addEventListener("click", function () { show(b.getAttribute("data-tab"), true); }); });
    $$("[data-out]", root).forEach(function (b) { b.addEventListener("click", function () { NS.logout(false); }); });
    show(current, false);
  }

  function show(id, push) {
    var s = auth.get();
    if (!s || !s.profile) { renderLogin(); return; }
    current = id;
    var t = TABS.filter(function (x) { return x.id === id; })[0] || TABS[0];
    $$("[data-tab]", root).forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-tab") === t.id ? "true" : "false"); });
    $("#cab-h").textContent = t.t;
    $("#cab-upd").textContent = s.demo ? "пример" : (s.profile.updated ? "данные с сервера: " + ago(s.profile.updated) : "");
    var body = $("#cab-body");
    body.innerHTML = V[t.id](s.profile, s);
    NS.bindLinks(body);
    $$("[data-tab-link]", body).forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); show(a.getAttribute("data-tab-link"), true); }); });
    var tu = $("#topup", body);
    if (tu) tu.addEventListener("click", function () {
      if (S.links.topup) window.open(S.links.topup, "_blank", "noopener");
      else NS.toast("Пока пополнение — через администрацию в Discord. После оплаты доллары зачислят на аккаунт.");
    });
    var oa = $("[data-out-all]", body);
    if (oa) oa.addEventListener("click", function () { NS.logout(true); });
    var o1 = $("[data-out]", body);
    if (o1) o1.addEventListener("click", function () { NS.logout(false); });
    if (push) { try { history.replaceState(null, "", "#" + t.id); } catch (e) { } }
  }

  window.addEventListener("hashchange", function () {
    var h = (location.hash || "").replace("#", "");
    if (TABS.some(function (t) { return t.id === h; }) && $("#cab-body")) show(h, false);
  });

  /* обновить профиль с сервера */
  function refresh() {
    var s = auth.get();
    if (!s || s.demo || !s.token || !auth.api()) return;
    NS.api("/site/me").then(function (j) {
      if (j.profile) { s.profile = j.profile; auth.save(s); show(current, false); }
    }, function (e) {
      if (e.status === 401) { auth.clear(); renderLogin("Сессия закончилась. Войди заново кодом из игры."); }
    });
  }

  renderCabinet();
  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 60000);
})();
