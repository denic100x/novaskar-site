/* ==========================================================
   NOVA SCAR — общие скрипты сайта (17.10.2026)
   ========================================================== */
(function () {
  "use strict";

  var S = window.SITE || {};
  S.server = S.server || {}; S.links = S.links || {}; S.cabinet = S.cabinet || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  var ARROW = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15"/><path d="M13 6l6 6-6 6"/></svg>';
  var CHEV = '<svg class="ic chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  /* ---------- toast ---------- */
  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3400);
  }

  /* ---------- безопасное хранилище ---------- */
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { } },
  };

  /* ---------- сессия кабинета (общая для шапки и кабинета) ---------- */
  var SESSION_KEY = "ns_session";
  var auth = {
    get: function () { var s = store.get(SESSION_KEY); return s && (s.token || s.demo) ? s : null; },
    save: function (s) { s.savedAt = Date.now(); store.set(SESSION_KEY, s); renderUser(); },
    clear: function () { store.del(SESSION_KEY); renderUser(); },
    api: function () { return String(S.cabinet.api || "").replace(/\/+$/, ""); },
  };

  function apiCall(path, opts) {
    opts = opts || {};
    var base = auth.api();
    if (!base) return Promise.reject(new Error("no-api"));
    var headers = { "Accept": "application/json" };
    var s = auth.get();
    if (s && s.token) headers["Authorization"] = "Bearer " + s.token;
    if (opts.body) headers["Content-Type"] = "application/json";
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 10000) : null;
    return fetch(base + path, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) {
      if (t) clearTimeout(t);
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.ok === false) { var e = new Error(j.error || ("http-" + r.status)); e.status = r.status; e.data = j; throw e; }
        return j;
      });
    });
  }

  /* ---------- шапка: меню пользователя ---------- */
  function initials(name) { return esc(String(name || "?").trim().charAt(0).toUpperCase() || "?"); }
  function avaHtml(p) { return p && p.avatar ? '<img src="' + esc(p.avatar) + '" alt="" referrerpolicy="no-referrer">' : initials(p && p.nick); }
  function usd(cents) {
    var n = (Number(cents) || 0) / 100;
    return "$" + (Math.round(n * 100) % 100 ? n.toFixed(2) : String(Math.round(n)));
  }

  function renderUser() {
    var s = auth.get(), p = s && s.profile;
    $$("[data-user]").forEach(function (box) {
      if (!s || !p) {
        box.innerHTML = '<a class="btn btn-cyan" href="cabinet.html">Войти</a>';
        return;
      }
      box.innerHTML =
        '<button class="user-btn" type="button" aria-haspopup="true" aria-expanded="false">' +
        '<span class="ava">' + avaHtml(p) + '</span><span class="nm">' + esc(p.nick) + "</span>" + CHEV + "</button>" +
        '<div class="user-menu" hidden>' +
        '<div class="um-head"><span class="ava">' + avaHtml(p) + "</span><span><b>" + esc(p.nick) + "</b><small>" +
        (s.demo ? '<span class="demo-flag">ПРИМЕР</span> ' : "") + "Уровень " + esc(p.level || 1) + (p.title ? " · " + esc(p.title) : "") + "</small></span></div>" +
        '<a href="cabinet.html#overview">Личный кабинет</a>' +
        '<a href="cabinet.html#donate">Донат-баланс <span class="val">' + usd(p.donate && p.donate.balance) + "</span></a>" +
        '<a href="cabinet.html#season">Сезон <span class="val" style="color:var(--cyan)">' + esc(p.season ? "ур. " + (p.season.level || 0) : "—") + "</span></a>" +
        '<a href="cabinet.html#links">Привязки</a>' +
        '<div class="sep"></div><button type="button" class="out" data-logout>Выйти</button></div>';
      var btn = $(".user-btn", box), menu = $(".user-menu", box);
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = menu.hidden;
        closeMenus();
        menu.hidden = !open;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      $("[data-logout]", box).addEventListener("click", function () { logout(); });
    });
  }
  function closeMenus() {
    $$(".user-menu").forEach(function (m) { m.hidden = true; });
    $$(".user-btn").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  }
  document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest(".user-wrap")) closeMenus(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenus(); });

  function logout(all) {
    var s = auth.get();
    var done = function () {
      auth.clear();
      if (/cabinet\.html/.test(location.pathname)) { location.hash = ""; location.reload(); }
      else toast("Ты вышел из кабинета.");
    };
    if (s && s.token && auth.api()) apiCall("/site/logout", { body: { all: !!all } }).then(done, done);
    else done();
  }
  renderUser();

  /* ---------- сервер: адрес, подключение ---------- */
  var ip = String(S.server.ip || "").trim();
  var port = S.server.port || 27015;
  var addr = ip ? ip + ":" + port : "";

  $$(".js-ip").forEach(function (el) { el.textContent = addr || "скоро"; });

  $$("[data-connect]").forEach(function (a) {
    if (addr) {
      a.setAttribute("href", "steam://connect/" + addr);
    } else {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        toast("Адрес сервера появится ближе к запуску. Пока смотри шаги ниже.");
        var how = $("#how");
        if (how) how.scrollIntoView({ behavior: "smooth" });
      });
    }
  });

  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!addr) { toast("Адрес сервера пока не опубликован."); return; }
      var done = function () { toast("Адрес скопирован: " + addr); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(addr).then(done, function () { toast(addr); });
      } else { toast(addr); }
    });
  });

  /* ---------- онлайн сервера ---------- */
  var statusCbs = [];
  function onStatus(cb) { statusCbs.push(cb); }
  function setStatus(st) {
    $$("[data-status]").forEach(function (el) {
      var dot = $(".dot", el), txt = $(".js-status-text", el);
      if (st && st.online) {
        if (dot) dot.classList.add("on");
        if (txt) txt.innerHTML = "Онлайн: <b>" + esc(st.players) + "</b> / " + esc(st.max || S.server.maxPlayers || 128);
      } else if (st && st.online === false) {
        if (txt) txt.textContent = "Сервер сейчас выключен";
      } else if (txt && addr) {
        txt.innerHTML = "Сервер: <b>" + esc(addr) + "</b>";
      }
    });
    statusCbs.forEach(function (cb) { try { cb(st); } catch (e) { } });
  }
  function loadStatus() {
    var bm = String(S.server.battlemetricsId || "").trim();
    var p;
    if (bm) {
      p = fetch("https://api.battlemetrics.com/servers/" + encodeURIComponent(bm)).then(function (r) { return r.json(); }).then(function (j) {
        var a = j && j.data && j.data.attributes;
        if (!a) throw new Error("bm");
        return { online: a.status === "online", players: a.players, max: a.maxPlayers };
      });
    } else if (auth.api()) {
      p = apiCall("/site/status").then(function (j) { return { online: !!j.online, players: j.players || 0, max: j.max }; });
    } else {
      p = Promise.resolve(null);
    }
    p.then(setStatus, function () { setStatus(null); });
  }
  if ($("[data-status]") || $("#gate")) loadStatus();

  /* ---------- внешние ссылки из config ---------- */
  function bindLinks(root) {
    $$("[data-link]", root).forEach(function (a) {
      if (a.__nsBound) return; a.__nsBound = true;
      var url = S.links[a.getAttribute("data-link")] || "";
      if (url) {
        a.setAttribute("href", url);
        if (/^https?:/i.test(url)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
        a.classList.remove("is-soon");
      } else {
        a.classList.add("is-soon");
        a.addEventListener("click", function (e) {
          e.preventDefault();
          toast(a.getAttribute("data-soon") || "Скоро — ссылка ещё не готова.");
        });
      }
    });
  }
  bindLinks(document);

  /* ---------- мобильное меню ---------- */
  var burger = $(".burger"), nav = $("#nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("open"); }); });
  }

  var yr = $("#year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- helpers ---------- */
  function liHtml(item) {
    if (typeof item === "string") return "<li>" + esc(item) + "</li>";
    return "<li>" + esc(item.text) + '<a href="' + esc(item.link.href) + '">' + esc(item.link.label) + "</a>" + esc(item.after || "") + "</li>";
  }
  function listHtml(items, cls) { return '<ul class="tick ' + (cls || "") + '">' + items.map(liHtml).join("") + "</ul>"; }
  function toneCls(t) { return t === "no" ? "tone-no" : t === "info" ? "tone-info" : ""; }
  function panelHtml(sec) {
    return '<div class="panel"><h3>' + esc(sec.h) + "</h3>" + listHtml(sec.items, toneCls(sec.tone)) + "</div>";
  }
  function places(n) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + " место";
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return n + " места";
    return n + " мест";
  }
  var STATUS = {
    live: ["gr", "Работает"], beta: ["cy", "Бета-тест"], dev: ["go", "В разработке"],
    plan: ["mu", "Скоро"], soon: ["am", "На старте"], later: ["rd", "Позже"],
  };
  function statusBadge(st) { var b = STATUS[st] || STATUS.plan; return '<span class="badge ' + b[0] + '">' + b[1] + "</span>"; }

  /* ---------- стартовый экран: игра → режим ---------- */
  var gate = $("#gate");
  if (gate && S.games) {
    var games = S.games;
    var stepper = $("#stepper"), cont = $("#continue");
    var title = $("#gate-title"), lead = $("#gate-lead");
    var accCls = function (g) { return "acc-" + (g.acc || "cyan"); };
    var art = function (g) {
      if (g.image) return '<img class="gp-art" src="' + esc(g.image) + '" alt="" decoding="async">';
      var t = document.getElementById("art-" + g.art); return t ? t.innerHTML : "";
    };
    var gameById = function (id) { for (var i = 0; i < games.length; i++) if (games[i].id === id) return games[i]; return null; };
    var liveCount = function (g) { return g.modes.filter(function (m) { return m.status === "live"; }).length; };
    var modesWord = function (n) { var m10 = n % 10, m100 = n % 100; return n + (m10 === 1 && m100 !== 11 ? " режим" : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? " режима" : " режимов"); };

    var renderStepper = function (g) {
      stepper.innerHTML = (g ? '<button class="st done" type="button" data-back><i>1</i>Игра: ' + esc(g.eng) + "</button>" : '<span class="st on"><i>1</i>Выбери игру</span>') +
        '<span class="ln"></span><span class="st' + (g ? " on" : "") + '"><i>2</i>Выбери режим</span>';
      var b = $("[data-back]", stepper);
      if (b) b.addEventListener("click", function () { go(""); });
    };

    var renderGames = function () {
      title.innerHTML = "Выбери <em>игру</em>";
      lead.textContent = "Один проект — несколько игр и режимов. Сначала выбери игру, потом режим.";
      renderStepper(null);
      gate.innerHTML = '<div class="pick-grid">' + games.map(function (g) {
        var live = liveCount(g);
        var st = live ? '<span class="badge gr">' + (live === 1 ? "Работает" : "Работают " + live) + "</span>" :
          statusBadge(g.modes[0] && g.modes[0].status);
        return '<a class="pick ' + accCls(g) + ' rv" href="#' + esc(g.id) + '" data-game="' + esc(g.id) + '">' + art(g) +
          '<span class="eyebrow">' + esc(g.eng) + "</span><h2>" + esc(g.name) + "</h2><p>" + esc(g.tagline) + "</p>" +
          '<span class="p-foot"><span>' + st + ' <span class="p-modes">' + modesWord(g.modes.length) + '</span></span><span class="p-go">Выбрать ' + ARROW + "</span></span></a>";
      }).join("") + "</div>";
      var last = store.get("ns_last_mode");
      if (last && last.url) {
        cont.hidden = false;
        cont.innerHTML = "Ты был здесь в прошлый раз: <a class=\"btn btn-line\" href=\"" + esc(last.url) + "\">" + esc(last.game) + " · " + esc(last.name) + " " + ARROW + "</a>";
      } else cont.hidden = true;
      reveal(gate);
    };

    var renderModes = function (g) {
      title.innerHTML = "Выбери <em>режим</em>";
      lead.textContent = g.eng + " · " + (g.note || "Выбери режим, в который хочешь играть.");
      renderStepper(g);
      cont.hidden = true;
      var cards = g.modes.map(function (m) {
        var live = m.status === "live" && m.url;
        var tag = live ? "a" : "div";
        var href = live ? ' href="' + esc(m.url) + '" data-mode="' + esc(m.id) + '"' : "";
        var foot = live
          ? '<span class="online" data-online="' + esc(m.id) + '">' + (m.id === "minicity" && addr ? '<span class="dot"></span>' + esc(addr) : "Режим открыт") + '</span><span class="btn btn-primary btn-sm">Открыть ' + ARROW + "</span>"
          : '<span class="online">' + (m.status === "dev" ? "Следи за новостями" : "Запуск позже") + "</span>";
        return "<" + tag + ' class="mode-card' + (live ? "" : " is-off") + '"' + href + ">" +
          (m.glyph ? '<span class="glyph" aria-hidden="true">' + esc(m.glyph) + "</span>" : "") +
          '<div class="m-top">' + statusBadge(m.status) + "</div><h3>" + esc(m.name) + '</h3><div class="m-sub">' + esc(m.sub || "") + "</div>" +
          (m.text ? "<p>" + esc(m.text) + "</p>" : "") + '<div class="m-go">' + foot + "</div></" + tag + ">";
      }).join("");
      var extra = "";
      if (g.id === "minecraft") extra = '<div class="gp-actions" style="padding:0 clamp(18px,3vw,40px) 28px;margin:0"><a class="btn btn-amber" href="#" data-link="launcher" data-soon="Лаунчер LAST CITY появится ближе к запуску.">Скачать лаунчер</a></div>';
      gate.innerHTML = '<div class="crumbs"><button type="button" data-back>Все игры</button><span>›</span><span>' + esc(g.eng) + "</span></div>" +
        '<section class="mode-stage ' + accCls(g) + '"><div class="gp-banner">' + art(g) + '<div class="eyebrow">' + esc(g.eng) + " · Nova Scar</div><h2>" + esc(g.name) + '</h2><p class="tagline">' + esc(g.tagline) + "</p></div>" +
        '<div class="mode-grid">' + cards + "</div>" + extra + "</section>";
      $("[data-back]", gate).addEventListener("click", function () { go(""); });
      $$("[data-mode]", gate).forEach(function (a) {
        a.addEventListener("click", function () {
          var m = g.modes.filter(function (x) { return x.id === a.getAttribute("data-mode"); })[0];
          if (m) store.set("ns_last_mode", { game: g.eng, name: m.name, url: m.url });
        });
      });
      bindLinks(gate);
      updateOnline(lastStatus);
    };

    var lastStatus = null;
    var updateOnline = function (st) {
      lastStatus = st;
      $$('[data-online="minicity"]', gate).forEach(function (el) {
        if (st && st.online) el.innerHTML = '<span class="dot on"></span>Онлайн: <b>' + esc(st.players) + "</b> / " + esc(st.max || 128);
        else if (st && st.online === false) el.innerHTML = '<span class="dot"></span>Сервер выключен';
      });
    };
    onStatus(updateOnline);

    var go = function (id) {
      try { history.pushState(null, "", id ? "#" + id : location.pathname); } catch (e) { location.hash = id; }
      route();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    var route = function () {
      var g = gameById((location.hash || "").replace("#", ""));
      if (g) renderModes(g); else renderGames();
    };
    gate.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("[data-game]");
      if (a) { e.preventDefault(); go(a.getAttribute("data-game")); }
    });
    window.addEventListener("popstate", route);
    window.addEventListener("hashchange", route);
    route();
  }

  /* ---------- новости ---------- */
  var newsEl = $("#news-list");
  if (newsEl) {
    var months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    var fmt = function (iso) {
      var p = String(iso).split("-");
      return p.length === 3 ? parseInt(p[2], 10) + " " + months[parseInt(p[1], 10) - 1] + " " + p[0] : iso;
    };
    newsEl.innerHTML = (S.news || []).map(function (n) {
      return '<article class="news-item rv"><div class="meta"><span class="badge cy">' + esc(n.tag || "Новости") + "</span><time datetime=\"" + esc(n.date) + '">' + esc(fmt(n.date)) + "</time></div><h3>" + esc(n.title) + "</h3><p>" + esc(n.text) + "</p></article>";
    }).join("") || '<div class="no-results">Новостей пока нет.</div>';
  }

  /* ---------- о сервере: структуры и экономика ---------- */
  var st = window.CITY_STRUCTURES;
  if (st) {
    var sl = $("#struct-launch");
    if (sl) sl.innerHTML = st.launch.map(function (s) {
      return '<a class="struct-item rv" href="professions.html#' + esc(s.group) + '"><span class="e">' + s.icon + "</span><span><b>" + esc(s.name) + "</b><small>" + esc(s.note) + "</small></span></a>";
    }).join("");
  }
  var eco = window.ECONOMY;
  if (eco) {
    var ei = $("#eco-income"), ee = $("#eco-exp");
    if (ei) ei.innerHTML = listHtml(eco.income);
    if (ee) ee.innerHTML = listHtml(eco.expenses, "tone-no");
  }

  /* ---------- правила: законы ---------- */
  var laws = window.CITY_LAWS;
  if (laws) {
    var li = $("#laws-intro"), ll = $("#laws-list"), lp = $("#ladder");
    if (li) li.textContent = laws.intro;
    if (ll) ll.innerHTML = laws.base.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
    if (lp) lp.innerHTML = laws.punishments.map(function (t, i) { return '<div class="rung"><small>ШАГ ' + (i + 1) + "</small>" + esc(t) + "</div>"; }).join("");
  }

  /* ---------- профессии ---------- */
  var root = $("#prof-root");
  if (root && window.PROF_GROUPS) {
    var groups = window.PROF_GROUPS;
    var kindLabel = { gov: "Государственная структура", civil: "Гражданские", crime: "Нелегальные" };
    var kindBadge = { gov: "cy", civil: "", crime: "go" };
    var badgeCls = function (b) { return /VIP|PREMIUM|LEGEND|\$/.test(b) ? "go" : "vi"; };

    var roleHtml = function (r) {
      var slots = r.slots ? places(r.slots) : "без лимита";
      var counts = r.sections.map(function (s) { return s.h.toLowerCase() + " " + s.items.length; }).slice(0, 3).join(" · ");
      var body = (r.menu ? '<div class="role-menu"><b>Меню</b><span>' + esc(r.menu) + "</span></div>" : "") +
        (r.access ? '<div class="role-menu role-access"><b>Доступ</b><span>' + esc(r.access) + "</span></div>" : "") +
        r.sections.map(function (s) {
          return '<div class="' + toneCls(s.tone) + '"><h4>' + esc(s.h) + "</h4>" + listHtml(s.items, toneCls(s.tone)) + "</div>";
        }).join("");
      var hay = (r.name + " " + r.about + " " + (r.menu || "") + " " + (r.badge || "") + " " + r.sections.map(function (s) { return s.items.join(" "); }).join(" ")).toLowerCase();
      var tags = (r.badge ? '<span class="badge ' + badgeCls(r.badge) + '">' + esc(r.badge) + "</span> " : "") + (r.menu ? '<span class="badge cy">Своё меню</span>' : "");
      return '<details class="role" id="job-' + esc(r.cmd || "") + '" data-hay="' + esc(hay) + '" data-name="' + esc(r.name.toLowerCase()) + '">' +
        '<summary><span class="r-ic">' + r.icon + '</span><span class="r-name">' + esc(r.name) + '</span><span class="r-slots badge ' + (r.slots ? "cy" : "") + '">' + slots + "</span>" +
        '<p class="r-about">' + esc(r.about) + "</p>" +
        (tags ? '<span class="r-tags">' + tags + "</span>" : "") +
        '<span class="r-more"><span class="cnt">' + esc(counts) + '</span><span>Подробнее <span class="chev">›</span></span></span></summary>' +
        '<div class="role-body">' + body + "</div></details>";
    };

    root.innerHTML = groups.map(function (g) {
      return '<section class="group-block" id="g-' + g.id + '" data-group="' + g.id + '">' +
        '<div class="group-head"><span class="g-ic">' + g.icon + '</span><div><span class="badge ' + kindBadge[g.kind] + '">' + kindLabel[g.kind] + "</span><h2>" + esc(g.title) + "</h2></div></div>" +
        '<p class="group-intro">' + esc(g.intro) + "</p>" +
        (g.summary && g.summary.length ? '<div class="sum-grid">' + g.summary.map(panelHtml).join("") + "</div>" : "") +
        '<div class="roles">' + g.roles.map(roleHtml).join("") + "</div>" +
        (g.notes && g.notes.length ? '<div class="notes">' + g.notes.map(panelHtml).join("") + "</div>" : "") +
        "</section>";
    }).join("") + '<div class="no-results" id="no-res" hidden>Ничего не нашли. Попробуй другое слово.</div>';

    var tabsEl = $("#tabs");
    var total = groups.reduce(function (n, g) { return n + g.roles.length; }, 0);
    tabsEl.innerHTML = '<button class="tab" role="tab" data-tab="all" aria-selected="true">Все <span class="n">' + total + "</span></button>" +
      groups.map(function (g) {
        return '<button class="tab" role="tab" data-tab="' + g.id + '" aria-selected="false">' + g.icon + " " + esc(g.tab) + ' <span class="n">' + g.roles.length + "</span></button>";
      }).join("");

    var current = "all";
    var input = $("#prof-search");
    var apply = function () {
      var q = (input.value || "").trim().toLowerCase();
      var any = false;
      $$(".group-block", root).forEach(function (blk) {
        var inTab = current === "all" || blk.getAttribute("data-group") === current;
        var shown = 0;
        $$(".role", blk).forEach(function (r) {
          var hit = !q || r.getAttribute("data-hay").indexOf(q) > -1;
          r.hidden = !hit;
          if (hit) shown++;
        });
        var vis = inTab && shown > 0;
        blk.hidden = !vis;
        $$(".sum-grid, .notes, .group-intro", blk).forEach(function (x) { x.hidden = !!q; });
        if (vis) any = true;
      });
      $("#no-res").hidden = any;
    };
    var selectTab = function (id, push) {
      current = id;
      $$(".tab", tabsEl).forEach(function (t) { t.setAttribute("aria-selected", t.getAttribute("data-tab") === id ? "true" : "false"); });
      apply();
      if (push) { try { history.replaceState(null, "", id === "all" ? location.pathname : "#" + id); } catch (e) { } }
      if (push && id !== "all") window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 150, behavior: "smooth" });
    };
    tabsEl.addEventListener("click", function (e) {
      var b = e.target.closest(".tab");
      if (b) selectTab(b.getAttribute("data-tab"), true);
    });
    input.addEventListener("input", apply);
    var h = (location.hash || "").replace("#", "");
    if (h && groups.some(function (g) { return g.id === h; })) selectTab(h, false);
    else if (h.indexOf("job-") === 0 && document.getElementById(h)) {
      apply();
      var d = document.getElementById(h); d.open = true;
      setTimeout(function () { d.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60);
    }
    else apply();
  }

  /* ---------- возможности ---------- */
  var keysEl = $("#keys");
  if (keysEl && window.KEYS) {
    keysEl.innerHTML = window.KEYS.map(function (k) { return '<div class="key rv"><kbd>' + esc(k.k) + "</kbd><span>" + esc(k.t) + "</span></div>"; }).join("");
    var cmdsEl = $("#cmds");
    if (cmdsEl && window.COMMANDS) cmdsEl.innerHTML = window.COMMANDS.map(function (c) { return '<span class="cmd"><code>' + esc(c.c) + "</code>" + esc(c.t) + "</span>"; }).join("");
  }
  var sysEl = $("#systems");
  if (sysEl && window.SYSTEMS) {
    sysEl.innerHTML = window.SYSTEMS.map(function (g) {
      return '<div class="sys-group" id="' + esc(g.id) + '"><h3 class="g rv"><span>' + g.icon + "</span>" + esc(g.title) + '</h3><div class="sys-grid">' +
        g.items.map(function (it) {
          return '<article class="sys rv"><div class="s-top"><h4>' + esc(it.name) + "</h4>" + statusBadge(it.status) + "</div><p>" + esc(it.text) + "</p>" +
            (it.how ? '<div class="how">Открыть: <code>' + esc(it.how) + "</code></div>" : "") + "</article>";
        }).join("") + "</div></div>";
    }).join("");
    var soonEl = $("#soon");
    if (soonEl && window.SOON) soonEl.innerHTML = window.SOON.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
  }

  /* ---------- донат ---------- */
  var D = window.DONATE;
  if (D && $("#tiers")) {
    var fmtRate = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); };
    $$(".js-rate").forEach(function (e) { e.textContent = fmtRate(D.rate); });
    $$(".js-bonus").forEach(function (e) { e.textContent = D.bonus; });
    $$(".js-tier-note").forEach(function (e) { e.textContent = D.tierNote; });
    $$(".js-soon").forEach(function (e) { e.textContent = D.soon.join(", ").toLowerCase(); });
    $("#tiers").innerHTML = D.tiers.map(function (t) {
      return '<div class="tier t-' + esc(t.id) + ' rv">' + (t.hot ? '<span class="badge cy hot">Популярный</span>' : "") + "<h3>" + esc(t.name) + "</h3>" +
        '<div class="prices"><div class="pr"><small>30 дней</small><b>$' + esc(t.monthly) + '</b></div><div class="pr"><small>Навсегда</small><b>$' + esc(t.forever) + "</b></div></div>" +
        '<ul class="tick">' + t.perks.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" +
        '<a class="btn btn-gold" href="cabinet.html#donate">Купить в игре: F4 → Донат</a></div>';
    }).join("");
    var ditem = function (x, body) {
      return '<div class="ditem rv"><div class="d-top"><h4>' + esc(x.name) + '</h4><span class="p">' + esc(x.price) + "</span></div>" + body + "</div>";
    };
    $("#jobsubs").innerHTML = D.jobSubs.map(function (j) {
      return ditem(j, '<span class="alt">' + esc(j.alt) + '</span><ul class="tick">' + j.perks.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>");
    }).join("");
    $("#shop").innerHTML = D.shop.map(function (s) { return ditem(s, "<p>" + esc(s.text) + "</p>"); }).join("");
    $("#phone tbody").innerHTML = D.phone.map(function (p) { return "<tr><td>" + esc(p.kind) + "</td><td>" + esc(p.ex) + '</td><td class="num">' + esc(p.price) + "</td></tr>"; }).join("");
    $("#season tbody").innerHTML = D.season.map(function (p) { return "<tr><td>" + esc(p.name) + '</td><td class="num">' + esc(p.price) + "</td></tr>"; }).join("");
    $("#howto").innerHTML = D.howTo.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
  }

  /* ---------- плавное появление ---------- */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }) : null;
  function reveal(scope) {
    $$(".rv", scope || document).forEach(function (el) {
      if (el.__rv) return; el.__rv = true;
      if (io) io.observe(el); else el.classList.add("in");
    });
  }
  reveal(document);

  /* ---------- для cabinet.js ---------- */
  window.NS = { $: $, $$: $$, esc: esc, toast: toast, store: store, auth: auth, api: apiCall, usd: usd, avaHtml: avaHtml, reveal: reveal, logout: logout, renderUser: renderUser, bindLinks: bindLinks, onStatus: onStatus };
})();
