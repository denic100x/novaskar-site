# Сайт Nova Scar — как устроен и что доделать (17.10.2026)

## Структура

Сайт статический: HTML + CSS + JS, сервер для него не нужен. Открывается двойным кликом по `index.html` или с любого хостинга (GitHub Pages и т.п.).

| Файл | Что это |
|---|---|
| `index.html` | **Вход на сайт: выбор игры → выбор режима.** Garry's Mod (Mini City RP — работает, SCP RP — в разработке), Minecraft (LAST CITY), CS 1.6. Сайт помнит, где игрок был в прошлый раз. |
| `minicity.html` | Главная режима Mini City RP (бывшая `index.html`) |
| `about.html` | О сервере: структуры города, экономика с цифрами |
| `systems.html` | **Новое.** Возможности: клавиши, команды, все системы сервера со статусом (работает / бета-тест / в разработке), «Скоро на сервере» |
| `professions.html` | 34 профессии — тексты взяты прямо из игры (F4), плюс меню профессии и донат-доступ |
| `rules.html` | Правила: «Важно знать», законы города, наказания |
| `donate.html` | Статусы VIP / PREMIUM / LEGEND, платные профессии, магазин, красивые номера, сезон, как пополнить |
| `news.html` | Новости |
| `cabinet.html` | **Новое.** Личный кабинет |
| `projects.html` | Старый адрес — перекидывает на `index.html` |

| JS | Что внутри |
|---|---|
| `js/config.js` | **Главные настройки:** адрес сервера, ссылки (Discord, Workshop, оплата), игры и режимы, новости, адрес API кабинета |
| `js/professions-data.js` | Профессии, законы, экономика |
| `js/donate-data.js` | Цены доната (копия `nova_donate/sh_config.lua`) |
| `js/systems-data.js` | Системы сервера и их статусы, клавиши, команды |
| `js/app.js` | Общий код сайта, меню пользователя в шапке |
| `js/cabinet.js` | Личный кабинет |

**Адреса без .html:** на сайте страницы открываются как `novaskar.com/minicity`, `/donate`, `/cabinet` (GitHub Pages сам находит `minicity.html`). Старые ссылки с `.html` тоже работают — строка адреса сама становится короткой. Если открыть сайт двойным кликом по файлу, ссылки тоже работают (app.js дописывает `.html`).

Шапка и подвал собираются скриптом `build.py` (лежит в `Claude Mini_City_RP\nova_site_src\`). Если правишь только тексты в `js/*.js` — пересобирать ничего не нужно.

## Частые правки

- **Второй режим Garry's Mod** — в `config.js`, `games → gmod → modes`, второй элемент (`name: "SCP RP"`). Когда режим запустится: `status: "live"` и `url` на его страницу.
- **Новость** — добавь объект в начало `news` в `config.js`.
- **Статус системы** («Бета-тест» → «Работает») — `status` в `systems-data.js`.
- **Цены доната** — `donate-data.js` (и не забудь `nova_donate/sh_config.lua` в игре).
- **Коллекция Workshop, VK, оплата** — `links` в `config.js`.
- **Онлайн на сайте** — найди сервер на battlemetrics.com и впиши его ID в `server.battlemetricsId`.

## Личный кабинет

`cabinet.api` = `https://api.novaskar.com:25662` — это бот основного Discord на Sparked Host. В шапке на всех страницах — меню пользователя: кабинет, донат-баланс, сезон, привязки, выход. Кнопка «Открыть пример кабинета» всегда показывает кабинет на демо-данных.

Разделы кабинета: Обзор (уровень, опыт, финансы, онлайн/профессия, донат), Донат (баланс, статус, подписки, история), Сезон, Квесты, Привязки (Steam, Discord, паспорт, телефон), Безопасность (выход, выход на всех устройствах).

### Как кабинет связывается с игрой

```
Игрок в игре: F4 → Настройки → «Сайт и личный кабинет» → «Получить код» (6 цифр, 10 минут)
        │  аддон nova_site добавляет код и снимок профиля в POST /nova/sync (nova_discord → бот)
        ▼
Сайт: игрок вводит код → POST https://api.novaskar.com:25662/site/login → бот выдаёт токен (30 дней)
        ▼
Сайт: GET /site/me → профиль (бот хранит последний снимок из игры), обновление раз в минуту
```

Состояние на 17.10.2026: аддон `nova_site` и патчи `nova_discord`/`nova_f4menu` — на MyArena; бот с `/site/*` и HTTPS — на Sparked Host.

### HTTPS (без Cloudflare)

Сайт на https может обращаться только к https-адресу. Cloudflare не используем: в РФ его замедляют. Бот сам получает сертификат Let's Encrypt для `api.novaskar.com` и продлевает его (файл бота `main/src/tls.js`). Один раз нужно:

1. Аккаунт на **desec.io** (бесплатный DNS) с доменом `<имя>.dedyn.io` и токен → вставить в первую строку `main/desec_token.txt` на Sparked Host → Save.
2. В DNS novaskar.com (Squarespace) две записи:
   - `A` · `api` → `45.43.163.175`
   - `CNAME` · `_acme-challenge.api` → `_acme-challenge.<имя>.dedyn.io`

Через пару минут в логе бота: `[HTTPS] Сертификат получен`. Проверка: https://api.novaskar.com:25662/site/status.

### Формат профиля (`profile`)

```json
{
  "steamid": "7656119…", "nick": "RP-имя", "avatar": "https://…",
  "online": true, "job": "Офицер полиции", "lastSeen": 1792200000,
  "playtime": 149100,
  "level": 23, "xp": 3200, "xpNeed": 5400, "xpTotal": 76100, "title": "Житель",
  "money": 18450, "bank": 126300,
  "donate": {
    "balance": 3250, "tier": "vip", "tierExpires": 1793800000,
    "subs": [{ "name": "Диджей", "expires": 1793000000, "forever": false }],
    "history": [{ "t": 1792100000, "text": "Пополнение баланса", "cents": 10000 }]
  },
  "season": { "name": "Первый город", "ends": 1798750740, "level": 12, "xp": 640, "xpNeed": 1200, "premium": false },
  "quests": [{ "kind": "Дневной", "name": "Помощь горожанам", "progress": 3, "goal": 5, "reward": "500 $ + 300 опыта", "done": false }],
  "discord": { "linked": true, "name": "Имя", "username": "login" },
  "passport": "MC-0418", "phone": "4721",
  "updated": 1792200000
}
```
Время — unix-секунды. `donate.balance` и `cents` — в центах (как в nova_donate). `tierExpires: 0` — навсегда.

## Публикация

Сайт живёт на GitHub Pages: репозиторий **github.com/denic100x/novaskar-site** (ветка `main`, корень), домен **https://novaskar.com** (файл `CNAME`), HTTPS включён. Записи DNS в Squarespace: `A @` → 185.199.108.153 / .109.153 / .110.153 / .111.153, `CNAME www` → `denic100x.github.io`.

Обновить сайт: github.com/denic100x/novaskar-site → открыть папку → «Add file» → «Upload files» → перетащить изменённые файлы → «Commit changes». Через 1–2 минуты изменения на novaskar.com.
