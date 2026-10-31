/* ==========================================================
   NOVA SCAR — личный кабинет (обновлено 31.10.2026)

   Один аккаунт Nova Scar — все игры. Игровые аккаунты (Mini City RP,
   NS-Deadzone, CS 1.6) добавляются внутри кабинета, в разделе «Игры».

   Как работает:
   - SITE.cabinet.api пустой → вход пока недоступен, можно открыть
     пример кабинета с демо-данными.
   - Вход кодом из игры (работает сейчас, Mini City RP):
       POST {api}/site/login   { code }   → { ok, token, profile }
   - Единый вход (включается в SITE.cabinet.auth, когда бот поддержит):
       POST {api}/auth/login    { email, password }       → { ok, token, profile }
       POST {api}/auth/register { email, password, nick } → { ok, token, profile }
       POST {api}/auth/reset    { email }                 → { ok }
       GET  {api}/auth/<google|vk|telegram|discord>       → редирект на novaskar.com/cabinet?token=…
   - Игры:
       POST {api}/site/link     { game, code }            → { ok, profile }   (подтвердить аккаунт игры кодом)
   - Общее:
       GET  {api}/site/me      (Bearer)   → { ok, profile }
       POST {api}/site/logout  { all }    → { ok }
       GET  {api}/site/status             → { ok, online, players, max }
   Формат profile — в README_САЙТ.md. Поле profile.games (если бот отдаёт):
       { gmod: { nick, steamid }, minecraft: { nick, uuid }, cs: null }
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
      games: { gmod: { nick: "Алекс Новак", steamid: "76561190000000000" }, minecraft: null, cs: null },
      passport: "MC-0418", phone: "4721",
      updated: now - 40,
    };
  }

  /* ---------------- аккаунт создателя (предпросмотр без сервера) ---------------- */
  var OWNER = S.cabinet.owner || null;
  function sha256(str) { // компактная реализация (работает и при открытии файла двойным кликом)
    var K = [], H = [1779033703, -1150833019, 1013904242, -1521486534, 1359893119, -1694144372, 528734635, 1541459225];
    for (var i = 0, p = 2; i < 64; p++) { var isP = true; for (var d = 2; d * d <= p; d++) if (p % d === 0) { isP = false; break; } if (isP) { K[i++] = (Math.pow(p, 1 / 3) * 4294967296) | 0; } }
    var bytes = unescape(encodeURIComponent(str)), l = bytes.length, words = [];
    for (i = 0; i < l; i++) words[i >> 2] |= bytes.charCodeAt(i) << (24 - (i % 4) * 8);
    words[l >> 2] |= 0x80 << (24 - (l % 4) * 8); words[((l + 8) >> 6 << 4) + 15] = l * 8;
    var w = [], rotr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (var j = 0; j < words.length; j += 16) {
      var a = H[0], b = H[1], c = H[2], dd = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        if (i < 16) w[i] = words[j + i] | 0;
        else { var g0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), g1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + g0 + w[i - 7] + g1) | 0; }
        var t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        var t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (dd + t1) | 0; dd = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + dd) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ("00000000" + (x >>> 0).toString(16)).slice(-8); }).join("");
  }
  function ownerProfile() {
    var now = Math.floor(Date.now() / 1000);
    return {
      nick: OWNER.nick || "Создатель", email: OWNER.email || "", avatar: "", online: false, title: "Основатель Nova Scar",
      level: 1, xp: 0, xpNeed: 100, xpTotal: 0, playtime: 0, money: 0, bank: 0,
      donate: { balance: 0, tier: "legend", tierExpires: 0, subs: [], history: [] },
      season: { name: "Первый город", ends: Math.floor(new Date("2026-12-31T23:59:00+03:00").getTime() / 1000), level: 0, xp: 0, xpNeed: 1200, premium: true },
      quests: [], discord: { linked: false }, games: { gmod: null, minecraft: null, cs: null }, updated: now,
    };
  }
  function ownerLogin(email, password) {
    if (!OWNER || !OWNER.hash) return false;
    if (String(email || "").trim().toLowerCase() !== String(OWNER.email || "").toLowerCase()) return false;
    return sha256(String(password || "")) === String(OWNER.hash).toLowerCase();
  }

  /* ---------------- вход ---------------- */
  var AUTH = S.cabinet.auth || {};
  var CODE_GAMES = S.cabinet.codeGames || [{ id: "gmod", name: "Mini City RP", eng: "Garry's Mod", hint: S.cabinet.codeHint || "", ready: true }];
  var codeGame = CODE_GAMES[0].id;
  function gameToggle(id) {
    return '<div class="toggle code-games" id="' + id + '" role="group" aria-label="Игра">' + CODE_GAMES.map(function (g) {
      return '<button type="button" data-game="' + esc(g.id) + '" aria-pressed="' + (g.id === codeGame) + '">' + esc(g.name) + "</button>";
    }).join("") + "</div>";
  }
  function bindGameToggle(root2, onChange) {
    var tg = $(".code-games", root2); if (!tg) return;
    tg.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      codeGame = b.getAttribute("data-game");
      $$("button", tg).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      if (onChange) onChange(codeGame);
    });
  }
  function gameHint(id) { var g = CODE_GAMES.filter(function (x) { return x.id === id; })[0] || {}; return (g.hint || "") + (g.ready === false ? " Сервер ещё не открыт — код появится вместе с ним." : ""); }
  var SOCIAL = [
    { id: "google", name: "Google", ic: "G" },
    { id: "vk", name: "VK", ic: "VK" },
    { id: "telegram", name: "Telegram", ic: "TG" },
    { id: "discord", name: "Discord", ic: "DS" },
  ];
  function codeForm(id, btn) {
    return '<form class="code-row" id="' + id + '" autocomplete="off"><input class="code-in" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="000000" aria-label="Код из игры"><button class="btn btn-primary" type="submit">' + btn + "</button></form>";
  }
  function bindCode(form, path, extra, onOk) {
    var input = $(".code-in", form), errEl = $(".login-err", form.parentNode) || $(".login-err");
    input.addEventListener("input", function () { input.value = input.value.replace(/\D/g, "").slice(0, 6); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var code = input.value.trim();
      if (!/^\d{6}$/.test(code)) { if (errEl) errEl.textContent = "Код — это 6 цифр из игры."; return; }
      if (errEl) errEl.textContent = "Проверяем код…";
      var body = { code: code, game: codeGame };
      for (var k in extra) body[k] = extra[k];
      NS.api(path, { body: body }).then(onOk, function (e2) {
        var msg = e2.status === 404 || e2.message === "bad-code" ? "Код не найден или устарел. Получи новый в игре." :
          e2.status === 429 ? "Слишком много попыток. Подожди минуту." : "Не удалось связаться с сервером. Попробуй позже.";
        if (errEl) errEl.textContent = msg; else NS.toast(msg);
      });
    });
  }

  function renderLogin(err) {
    var api = auth.api();
    var anySocial = SOCIAL.some(function (x) { return AUTH[x.id]; });
    var social = SOCIAL.map(function (x) {
      var url = AUTH[x.id];
      return url
        ? '<a class="soc soc-' + x.id + '" href="' + esc(url) + '"><i>' + x.ic + "</i>" + x.name + "</a>"
        : '<button class="soc soc-' + x.id + ' is-soon" type="button" data-soon="Вход через ' + x.name + ' подключается. Пока войди кодом из игры."><i>' + x.ic + "</i>" + x.name + "</button>";
    }).join("");
    root.innerHTML =
      '<div class="login-card rv">' +
      '<div class="eyebrow">Nova Scar · единый аккаунт</div><h2>Вход в Nova Scar</h2>' +
      "<p>Один аккаунт — все игры проекта: Garry's Mod, Minecraft, CS 1.6. Войди, а свои игровые аккаунты добавь в разделе «Игры».</p>" +
      '<div class="login-social">' + social + "</div>" +
      '<div class="login-or"><span>или по почте</span></div>' +
      '<form class="login-mail" id="mail-form" autocomplete="on">' +
      '<input type="email" name="email" placeholder="Почта" aria-label="Почта" autocomplete="email" required>' +
      '<input type="password" name="password" placeholder="Пароль" aria-label="Пароль" autocomplete="current-password" required>' +
      '<button class="btn btn-primary" type="submit">Войти</button>' +
      '<div class="login-links"><a href="#" data-reg>Регистрация</a><a href="#" data-reset>Забыл пароль</a></div>' +
      (AUTH.email && api ? "" : '<div class="login-note">Вход по почте и через соцсети подключается. Сейчас войти можно кодом из игры — ниже.</div>') +
      "</form>" +
      '<div class="login-err" id="login-err">' + esc(err || "") + "</div>" +
      '<details class="login-code"' + (AUTH.email && api ? "" : " open") + '><summary>Войти кодом из игры <span class="badge cy">регистрация</span></summary>' +
      (api
        ? '<p class="note-small" style="margin:10px 0 10px">Выбери игру, получи в ней код и введи его — аккаунт Nova Scar создастся автоматически. Этот же код подтверждает игровой аккаунт в разделе «Игры».</p>' + gameToggle("login-games") +
          '<p class="note-small js-code-hint" style="margin:0 0 12px">' + esc(gameHint(codeGame)) + "</p>" + codeForm("login-form", "Войти")
        : '<div class="notice"><span>⏳</span><span><b>Вход скоро откроется.</b> Кабинет подключается к игровому серверу. Пока посмотри, как он будет выглядеть.</span></div>') +
      "</details>" +
      '<div class="login-alt"><span>' + (api ? "Хочешь сначала посмотреть?" : "Данные в примере ненастоящие.") + '</span><button class="btn btn-line" type="button" id="demo-btn">Открыть пример кабинета</button></div>' +
      "</div>";
    NS.reveal(root);
    NS.bindLinks(root);
    $$(".soc.is-soon", root).forEach(function (b) { b.addEventListener("click", function () { NS.toast(b.getAttribute("data-soon")); }); });
    $("#demo-btn").addEventListener("click", function () {
      auth.save({ demo: true, profile: demoProfile() });
      renderCabinet();
    });
    var mail = $("#mail-form");
    bindGameToggle(root, function (id) { var hh = $(".js-code-hint", root); if (hh) hh.textContent = gameHint(id); });
    mail.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd0 = new FormData(mail);
      if (ownerLogin(fd0.get("email"), fd0.get("password"))) {
        auth.save({ owner: true, profile: ownerProfile() });
        renderCabinet();
        return;
      }
      if (!(AUTH.email && api)) { $("#login-err").textContent = OWNER ? "Неверная почта или пароль." : ""; if (!OWNER) NS.toast("Вход по почте подключается — пока войди кодом из игры."); return; }
      var fd = new FormData(mail);
      $("#login-err").textContent = "Входим…";
      NS.api("/auth/login", { body: { email: fd.get("email"), password: fd.get("password") } }).then(function (j) {
        auth.save({ token: j.token, profile: j.profile }); renderCabinet();
      }, function (e2) {
        $("#login-err").textContent = e2.status === 401 || e2.message === "bad-login" ? "Неверная почта или пароль." : "Не удалось войти. Попробуй позже.";
      });
    });
    $("[data-reg]", root).addEventListener("click", function (e) {
      e.preventDefault();
      if (!(AUTH.email && api)) { NS.toast("Регистрация по почте подключается. Пока аккаунт создаётся при первом входе кодом из игры."); return; }
      var fd = new FormData(mail), nick = prompt("Ник на сайте (можно поменять позже):");
      if (!nick) return;
      NS.api("/auth/register", { body: { email: fd.get("email"), password: fd.get("password"), nick: nick } }).then(function (j) {
        auth.save({ token: j.token, profile: j.profile }); renderCabinet();
      }, function (e2) { $("#login-err").textContent = e2.message === "exists" ? "Такая почта уже зарегистрирована." : "Не удалось зарегистрироваться. Проверь почту и пароль (от 8 символов)."; });
    });
    $("[data-reset]", root).addEventListener("click", function (e) {
      e.preventDefault();
      if (!(AUTH.email && api)) { NS.toast("Восстановление пароля подключается вместе со входом по почте."); return; }
      var email = new FormData(mail).get("email");
      if (!email) { $("#login-err").textContent = "Введи почту — на неё придёт ссылка для сброса пароля."; return; }
      NS.api("/auth/reset", { body: { email: email } }).then(function () { $("#login-err").textContent = "Письмо отправлено — проверь почту."; }, function () { $("#login-err").textContent = "Не удалось отправить письмо. Попробуй позже."; });
    });
    var form = $("#login-form");
    if (form) {
      bindCode(form, "/site/login", {}, function (j) { auth.save({ token: j.token, profile: j.profile }); renderCabinet(); });
      if (!(AUTH.email && api)) $(".code-in", form).focus();
    }
  }

  /* вход через соцсеть: бот возвращает на cabinet?token=… */
  (function () {
    var m = /[?&]token=([^&#]+)/.exec(location.search);
    if (!m || !auth.api()) return;
    var token = decodeURIComponent(m[1]);
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { }
    auth.save({ token: token, profile: { nick: "…" } });
    NS.api("/site/me").then(function (j) { if (j.profile) { auth.save({ token: token, profile: j.profile }); renderCabinet(); } }, function () { auth.clear(); renderLogin("Не удалось завершить вход. Попробуй ещё раз."); });
  })();

  /* ---------------- разделы ---------------- */
  var TABS = [
    { id: "overview", e: "🏠", t: "Обзор" },
    { id: "games", e: "🎮", t: "Игры" },
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
    return '<div class="game-strip"><span class="badge cy">Garry\'s Mod</span><b>Mini City RP</b><a href="#games" data-tab-link="games">Все игры аккаунта</a></div><div class="cgrid">' +
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
      '<p style="margin:16px 0 0;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-gold btn-sm" type="button" id="topup">Пополнить</button><a class="btn btn-line" href="donate">Цены и статусы</a></p></div>' +
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
      (s.premium ? '<span class="badge go">Открыта</span>' : '<a class="btn btn-gold btn-sm" href="donate">От $15</a>') + "</div>" +
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
  V.games = function (p, s) {
    var g = p.games || { gmod: p.steamid ? { nick: p.nick, steamid: p.steamid } : null, minecraft: p.minecraft || null, cs: null };
    var row = function (icon, game, mode, linked, body, cls) {
      return '<div class="gcard' + (cls ? " " + cls : "") + '"><div class="g-head"><span class="e">' + icon + '</span><span><small>' + esc(game) + "</small><b>" + esc(mode) + "</b></span>" +
        (linked ? '<span class="badge gr">Добавлен</span>' : '<span class="badge mu">Не добавлен</span>') + "</div>" + body + "</div>";
    };
    var gm = g.gmod;
    var gmBody = gm
      ? '<div class="kv"><div><span>Ник</span><b>' + esc(gm.nick || p.nick) + "</b></div><div><span>SteamID</span><b>" + esc(gm.steamid || "—") + "</b></div><div><span>Уровень</span><b>" + esc(p.level || 1) + "</b></div></div>" +
        (gm.steamid ? '<p style="margin:12px 0 0"><a class="btn btn-line btn-sm" href="https://steamcommunity.com/profiles/' + encodeURIComponent(gm.steamid) + '" target="_blank" rel="noopener">Профиль Steam</a> <a class="btn btn-line btn-sm" href="minicity">Mini City RP</a></p>' : "")
      : '<p class="note-small" style="margin:0 0 10px">Подтверди аккаунт кодом из игры: ' + esc(gameHint("gmod")) + "</p>" + (s.demo ? '<span class="badge mu">В примере недоступно</span>' : codeForm("link-gmod", "Подтвердить")) + '<div class="login-err"></div>';
    var mc = g.minecraft;
    var mcBody = mc
      ? '<div class="kv"><div><span>Ник</span><b>' + esc(mc.nick || "—") + "</b></div><div><span>UUID</span><b>" + esc(mc.uuid || "—") + "</b></div></div>"
      : '<p class="note-small" style="margin:0 0 10px">' + esc(gameHint("minecraft")) + ' <a href="deadzone/">О проекте</a></p>' + (s.demo ? '<span class="badge mu">В примере недоступно</span>' : codeForm("link-minecraft", "Подтвердить")) + '<div class="login-err"></div>';
    var csBody = '<p class="note-small" style="margin:0">Серверы Counter-Strike 1.6 запускаются позже — добавить аккаунт можно будет после запуска.</p>';
    return '<div class="cgrid">' +
      '<div class="ccard wide"><h3>Игры аккаунта</h3><p style="color:var(--muted);margin:0 0 16px">Один вход — все игры Nova Scar. Добавь аккаунт каждой игры, в которую играешь: прогресс, донат-баланс и статусы будут в одном кабинете.</p>' +
      '<div class="ggrid">' +
      row("🎮", "Garry\'s Mod", "Mini City RP", !!gm, gmBody) +
      row("⛏️", "Minecraft", "NS-Deadzone", !!mc, mcBody, mc ? "" : "is-soon") +
      row("🔫", "Counter-Strike 1.6", "Комплекс 01 · Dead Zone", false, csBody, "is-soon") +
      "</div></div></div>";
  };
  V.links = function (p) {
    var dc = p.discord || {};
    var mail = p.email || "";
    return '<div class="ccard">' +
      '<div class="link-row"><span class="li"><span class="e">✉️</span><span><b>Почта</b><small>' + esc(mail || "не привязана · подключается вместе с единым входом") + "</small></span></span>" +
      (mail ? '<span class="badge gr">Привязана</span>' : "") + "</div>" +
      '<div class="link-row"><span class="li"><span class="e">🎮</span><span><b>Игровые аккаунты</b><small>Mini City RP, NS-Deadzone, CS 1.6 — в разделе «Игры»</small></span></span><a class="btn btn-line btn-sm" href="#games" data-tab-link="games">Открыть</a></div>' +
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
      '<div class="ccard"><h3>Все устройства</h3><p style="color:var(--muted);margin:0 0 14px">Если входил с чужого компьютера — выйди везде. Потом войди заново: по почте, через соцсеть или кодом из игры.</p>' +
      '<button class="btn btn-line" type="button" data-out-all' + (s.demo || !s.token ? " disabled" : "") + ">Выйти на всех устройствах</button></div>" +
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
      (s.demo ? '<div class="notice" style="margin-bottom:18px"><span>👀</span><span><b>Это пример кабинета.</b> Данные ненастоящие — так кабинет будет выглядеть после входа. <button class="btn btn-line" type="button" data-out style="height:32px;margin-left:6px">Выйти из примера</button></span></div>' :
        s.owner && !s.token ? '<div class="notice" style="margin-bottom:18px"><span>👑</span><span><b>Аккаунт создателя.</b> Кабинет открыт в режиме предпросмотра — без сервера. Добавь игровой аккаунт кодом из игры в разделе «Игры», и данные подтянутся с сервера.</span></div>' : "") +
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
    var linkDone = function (name) {
      return function (j) {
        var ss = auth.get();
        if (j.token) ss.token = j.token;
        if (j.profile) { if (ss.owner) { j.profile.title = j.profile.title || ss.profile.title; j.profile.email = ss.profile.email; } ss.profile = j.profile; }
        auth.save(ss); show("games", false); NS.toast("Аккаунт " + name + " добавлен.");
      };
    };
    var lg = $("#link-gmod", body);
    if (lg) { codeGame = "gmod"; bindCode(lg, s.token ? "/site/link" : "/site/login", { game: "gmod" }, linkDone("Mini City RP")); }
    var lm = $("#link-minecraft", body);
    if (lm) bindCode(lm, s.token ? "/site/link" : "/site/login", { game: "minecraft" }, linkDone("NS-Deadzone"));
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
      if (e.status === 401) { auth.clear(); renderLogin("Сессия закончилась. Войди заново."); }
    });
  }

  renderCabinet();
  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 60000);
})();
