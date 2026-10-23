<div align="center">

# PokemonPaper

**Every paper becomes a Pokémon. Its number is the arXiv ID. Read it, and it lights up.**

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003b57?style=flat-square)](https://nodejs.org/api/sqlite.html)
[![License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](LICENSE)

**English** · [中文](#中文)

[Quick start](#quick-start) · [Design](#three-design-decisions) · [Structure](#project-structure) · [Roadmap](#roadmap) · [中文](#中文)

</div>

![PokemonPaper UI](docs/preview.png)

---

## What it is

The hard part of reading papers isn't reading — it's **remembering what you've read**. PokemonPaper turns it into a collection game:

- Add a paper and it becomes a sprite
- Unread papers are grey silhouettes; reading ones are half-colored; finished ones **light up**
- The number is the arXiv ID — `No.2610.28480` is always the same sprite
- Collection progress, trainer level, and colors derived from the arXiv category

All data stays in a local SQLite file. No cloud. The UI switches between Chinese and English.

<p align="center"><img src="docs/en.png" width="720" alt="English UI"></p>

## Features

| | |
|---|---|
| 🧬 **Deterministic sprites** | 32×32 pixels, 5 body types (biped / quadruped / blob / bird / ghost); the same arXiv ID always yields the same sprite |
| 👤 **Multi-user** | Register / log in, one dex per user; scrypt password hashing, HttpOnly session cookie |
| 📥 **Bulk import** | One arXiv ID or URL per line, up to 50; BibTeX and JSON backups too |
| 🔎 **Keyword search** | Search arXiv directly, 30 relevance-ranked results, tick to import; hides papers you already own by default |
| 🎲 **Random unread** | Pick a random paper you have not finished yet |
| 💬 **Shared notes** | Public by default; other readers of the same paper can see them (joined by arXiv ID, dashed outline). Uncheck to keep one private |
| 📊 **Statistics** | Distribution by category, year and venue, plus read rate and level mix |
| 🔦 **In-PDF search** | Search across pages, highlight matches, jump prev / next |
| 🏷️ **arXiv as the key** | Paste `https://arxiv.org/pdf/2610.28480` and the ID is extracted; duplicates are rejected per user |
| 🌗 **Three states** | Unread silhouette → reading (half color) → read (full color + gold star) |
| 🎖️ **Trainer levels** | XP from paper level, reading, and notes; 6 titles, 8 badges |
| 🗂️ **Two layouts** | Cards for sprites, list for information; choice persisted locally |
| 🏷️ **arXiv categories** | Full official taxonomy (155 categories); cards and rows show `cs.RO`, sprite colors follow the field |
| ⚔️ **Paper level** | Lv.1–100 from open-source availability and GitHub stars; tiers: common / rare / epic / legendary |
| 🤖 **AI paper cards** | One-liner / problem / method / key numbers / limits / next step via any OpenAI-compatible endpoint; key stays local |
| 📖 **PDF reader** | Original PDFs rendered page by page; select text to highlight and comment; cross-page selections are split and edited as one |
| 📄 **Local PDFs** | Files live in `data/pdfs/`; the DB stores URL + relative path, downloads on demand |
| 🔍 **Search** | Title / author / ID / tags / venue, `/` to focus |
| 💾 **Portable** | One-click JSON export, merge-import by arXiv ID |
| 🌐 **Bilingual UI** | Chinese and English, switchable in the header |

## Three design decisions

### 1. The number is the identity

An arXiv ID carries time (`2610` = October 2026). It is the business key, the sort key, and the sprite seed. Uniqueness is per user: `(user_id, arxiv)`.

### 2. Sprites must be reproducible

```ts
buildSprite(seed: string, category: string, locked: boolean): SpriteRect[]
```

An FNV-1a hash plus mulberry32 produces a deterministic rect list. No images, no asset pipeline — the sprite is computed from the ID. Locked sprites reuse the same geometry with a grey palette.

### 3. Categories are the taxonomy

There are no invented type names. The app ships the official arXiv taxonomy and shows the category code (`cs.RO`, `cs.CV`, …). Sprite palettes follow the top-level field, so papers from the same field share a color family.

## Quick start

```bash
git clone https://github.com/idejie/PokemonPaper.git
cd PokemonPaper
pnpm install
pnpm dev          # Vite on :5173, API on :8787
```

Open http://localhost:5173. The first registered account becomes the admin.

Production:

```bash
pnpm build
pnpm start        # serves dist/ and the API on :8787
```

Requirements: Node 22.5+ (for `node:sqlite`), pnpm.

## Usage

1. **Add a paper** — paste an arXiv ID / URL, or fill the form; metadata can be fetched from arXiv
2. **Import a batch** — `Import → arXiv`, up to 50 IDs; BibTeX and JSON are also supported
3. **Read it** — open the detail sheet, go to *Original PDF*, select text to highlight or comment
4. **Finish it** — mark as read; the sprite lights up and grants XP
5. **Summarize it** — configure an OpenAI-compatible endpoint in settings, then generate an AI summary from the full text

## Trainer levels

XP counts three things: **the paper's level, whether you finished it, and whether you wrote notes**.

| Action | XP |
|---|---|
| Finish a paper | paper level + 40 |
| Reading | half the level + 10 |
| Notes | +20 (+10 while reading) |
| Collected but unread | 0 |

Open source and stars already determine the paper level, so they are not counted again. The level curve is `50·(L−1)·L`. The progress bar in the header shows XP progress within the current level, not the share of papers read. The `?` button in the header opens a dedicated `/guide` page with the full rules, curve, titles, and badges.

## Project structure

```
paperdex/
├── server/index.mjs        # HTTP API + SQLite + PDF extraction
├── src/
│   ├── core/               # sprite, palette, arXiv taxonomy, level, progress
│   ├── stores/             # papers, auth, settings, ui, prefs
│   ├── views/              # Dex, Reader, Auth
│   └── components/         # cards, rows, dialogs, PDF viewer
├── data/                   # SQLite + PDFs (gitignored)
└── dist/                   # build output
```

## API

All endpoints except `/api/health` and auth require a session cookie.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` `login` `logout` | Auth |
| `GET` | `/api/auth/me` `config` | Current user / registration mode |
| `GET` `POST` | `/api/papers` | List / create |
| `PATCH` `DELETE` | `/api/papers/:id` | Update / delete |
| `POST` | `/api/papers/:id/pdf` | Download PDF on demand |
| `POST` | `/api/papers/:id/metrics` | Sync GitHub stars |
| `GET` `POST` | `/api/papers/:id/text` | Read / extract full text |
| `GET` `POST` | `/api/papers/:id/summary` | Read / generate summary |
| `GET` `POST` | `/api/papers/:id/annotations` | List / create annotations |
| `PATCH` `DELETE` | `/api/annotations/:id` | Edit / delete annotation |
| `POST` | `/api/papers/backfill` | Fill missing categories from arXiv |
| `POST` | `/api/arxiv/preview` | Fetch arXiv metadata |
| `POST` | `/api/arxiv/search` | Search arXiv by keywords |
| `POST` | `/api/explain` | Generate an AI paper card |

## Limits

- Scanned PDFs have no text layer: no text selection, and summaries fall back to the abstract
- In-PDF search matches per text-layer span; phrases split across spans may be missed

- Token usage and model costs are yours; keys never leave the browser except to the endpoint you configure
- GitHub star counts come from the GitHub API / HTML and may lag by minutes

## Roadmap

- [x] Deterministic sprites, three states
- [x] Multi-user accounts, invites, admin
- [x] arXiv import + BibTeX + AI paper cards
- [x] PDF reader with highlights and comments
- [x] Trainer levels, titles, badges
- [x] Bilingual UI (zh / en)
- [x] Statistics page: categories, years, venues
- [x] Cross-page annotations
- [x] Full-text search inside PDFs

## License

MIT © idejie

---

# 中文

**把每篇论文变成一只宝可梦。编号就是 arXiv 号，读完点亮。**

## 这是什么

读论文最难的不是读，是**记得自己读过什么**。PokemonPaper 把这件事做成收集游戏：

- 登记一篇论文，它变成一只精灵
- 没读的时候是灰色剪影，读的时候是半彩，读完**点亮**
- 编号就是 arXiv 号——`No.2610.28480` 永远是同一只
- 收集进度、训练家等级、按 arXiv 分类配色

数据全部留在本地 SQLite，不上云。界面支持中英文切换。

<p align="center"><img src="docs/en.png" width="720" alt="English UI"></p>

## 特性

| | |
|---|---|
| 🧬 **确定性精灵** | 32×32 像素，5 种体型（两足/四足/团子/鸟/幽灵），同一 arXiv 号永远生成同一只 |
| 👤 **多用户** | 注册 / 登录，每人一份独立图鉴；密码 scrypt 哈希，会话存 HttpOnly Cookie |
| 📥 **批量导入** | 一行一个 arXiv 编号或链接，最多 50 篇；也支持 BibTeX 和 JSON 备份 |
| 🔎 **关键词搜索** | 直接搜 arXiv，按相关性返回 30 条，勾选即导入；默认排除已收录 |
| 🎲 **随机未读** | 从还没点亮的论文里随机抽一篇，治选择困难 |
| 💬 **公开批注** | 批注默认公开，其他读者在同一篇论文上能看到（按 arXiv 号聚合，虚线高亮），可手动设为私有 |
| 📊 **统计页** | 分类、年份、会议分布，阅读率与等级构成 |
| 🔦 **PDF 内搜索** | 跨页搜索，命中高亮，支持上一处 / 下一处 |
| 🏷️ **arXiv 即主键** | 粘贴 `https://arxiv.org/pdf/2610.28480` 自动提取编号；重复登记会被拒绝 |
| 🌗 **三态点亮** | 未读剪影 → 在读半彩 → 已读全彩 + 金星 |
| 🎖️ **训练家等级** | 论文等级 + 阅读 + 笔记决定 XP；6 个称号、8 枚徽章 |
| 🗂️ **两种布局** | 卡片看精灵，列表看信息；选择记在本地 |
| 🏷️ **arXiv 分类** | 内置官方 155 个类目，卡片/列表直接显示 `cs.RO`，精灵按领域配色 |
| ⚔️ **论文等级** | Lv.1–100，由开源代码与 GitHub star 决定，分常见/稀有/史诗/传说 |
| 🤖 **AI 速读卡** | 一句话 / 问题 / 方法 / 关键数字 / 局限 / 下一步，OpenAI 兼容接口，Key 存本地 |
| 📖 **PDF 阅读器** | 原版 PDF 逐页渲染，选中文字可高亮、写批注；跨页选择自动拆段并同步编辑 |
| 📄 **PDF 本地化** | 原文存 `data/pdfs/`，库里只记链接和相对路径；没有就从 arXiv 现下 |
| 🔍 **检索** | 标题 / 作者 / 编号 / 标签 / 会议全文搜索，`/` 聚焦 |
| 💾 **可迁移** | 一键导出 JSON，按 arXiv 号合并导入 |
| 🌐 **中英双语** | 界面中英文切换，选择记在本地 |

## 三个设计决定

### 1. 编号即身份

arXiv 号自带时间信息（`2610` = 2026 年 10 月），既是业务主键，也是排序依据，也是精灵种子。数据库里 `(user_id, arxiv)` 是唯一索引，同一用户重复登记返回 `409`。

### 2. 精灵必须可复现

```ts
buildSprite(seed: string, category: string, locked: boolean): SpriteRect[]
```

输入一个字符串，输出 32×32 的矩形数组。只用 FNV-1a hash + mulberry32，**没有 `Math.random()`**。所以 `2610.28480` 在任何机器上都是同一只。

生成器不碰 DOM，换框架只换渲染层。

### 3. 游戏状态是阅读状态

没有签到、没有连击、没有虚拟货币。点亮只有一条路径：你真的把它读完了。未读的剪影和已读的全彩之间，只差一个诚实的点击。

## 账号

- 邮箱 + 密码注册，密码用 `scrypt`（随机 salt）哈希后存库，明文不落盘
- 登录后发一个 `HttpOnly; SameSite=Lax` 的会话 Cookie，30 天有效
- 每个账号的论文、笔记、PDF 完全隔离：所有查询都带 `user_id`
- 同一邮箱连续输错 5 次，锁 60 秒
- 顶栏右侧是训练家头像，点开「账号设置」可以换头像、改昵称
- 已登录状态下可以**改密码**，改完其它设备的会话立即失效
- **邀请制**：第一个注册的账号自动成为管理员，可以把注册方式切成「邀请制」并生成一次性邀请码
- 危险区支持**导出我的数据**和**注销账号**（连同论文、笔记、解读一起删除）

![账号设置](docs/account.png)

![登录](docs/login.png)

> 这是单机自托管服务：没有邮箱验证、没有找回密码、没有 OAuth。放在公网请套 HTTPS 反代。

## 导入论文

三种入口，都在右上角「导入」里：

| 来源 | 用法 |
|---|---|
| arXiv 批量 | 一次贴最多 50 个编号或链接，后端向 `export.arxiv.org` 拉标题、作者、摘要、年份 |
| BibTeX | 粘贴或上传 `.bib`，从 `eprint` / `url` 里提取编号；没有编号的会标黄提示 |
| JSON 备份 | 之前「导出」的文件，按 arXiv 号合并 |

已存在的论文只更新元数据，**不会覆盖**你的笔记、评分和阅读状态。

登记单篇时，arXiv 输入框旁边的「抓取」可以直接补全表单。

## AI 解读

详情页底部是「AI 解读」。点生成，会用摘要产出一张结构化速读卡：

```
一句话 · 问题 · 方法 · 关键数字 · 局限 · 下一步
```

![AI 解读](docs/explain.png)

模型走 OpenAI 兼容的 `/chat/completions`。设置里内置了 DeepSeek、OpenAI、Moonshot、智谱、OpenRouter 预设，也可以填任意自建端点。

- **Key 只存在浏览器 localStorage**，请求经本地服务转发，不写数据库、不打日志
- Prompt 明确要求「数字只能来自摘要，没有就留空」，减少编造
- 生成结果存进 SQLite 的 `explain` 字段，可以随时重新生成覆盖

## 分类与配色

**不另造属性名，直接用 arXiv 官方分类。** 内置完整分类树（155 个类目），导入和「抓取」自动带上，卡片和列表显示类目代码：

```
[cs.RO] CoRL 2026      [cs.CV] CVPR 2026      [cs.LG]
```

详情页有下拉可以改分类。精灵配色按一级领域走，同一领域的论文색调一致：

| 领域 | 配色 |
|---|---|
| `cs.RO` 机器人 | 蓝 |
| `cs.CV` 计算机视觉 | 青 |
| `cs.LG` 机器学习 | 紫 |
| `cs.AI` 人工智能 | 靛 |
| `cs.CL` 自然语言 | 玫红 |
| `eess.*` 电子工程 | 金 |
| `q-bio.*` 定量生物 | 绿 |
| 其他 | 按一级归档兜底 |

不再有「普通」这种默认标签，也没有“其他”分类——没收录的类目会归到对应的一级归档配色。

## 训练家等级

经验只看三件事：**论文等级、读没读完、有没有笔记**。

| 动作 | XP |
|---|---|
| 读完一篇 | 论文等级 + 40 |
| 在读 | 等级的一半 + 10 |
| 写了笔记 | +20（在读 +10） |
| 只收录没读 | 0 |

**开源和 star 不再单独加 XP**——它们已经决定了论文等级，再加一次就是双重计分。所以读一篇 Lv.82 的论文比读十篇 Lv.1 的更有价值，但前提是真的读完。

升级曲线是 `50·(L−1)·L`：Lv.2 需要 100 XP，Lv.5 需要 1000，Lv.10 需要 4500。顶栏进度条显示的是当前等级的经验进度，不是已读比例。

称号：新手训练家 → 见习研究员（5）→ 图鉴收集者（10）→ 论文猎人（20）→ 知识训练家（35）→ 文献大师（50）。

八枚徽章：初次登记、十篇达成、第一束光、十盏灯、笔记习惯、速读卡收藏家、开源猎人、本地图书馆。

点顶栏的头像打开「训练家档案」，能看到 XP 进度条、统计和徽章墙；顶栏的 `?` 进入独立的 `/guide` 页面，完整讲清楚等级、经验、曲线、称号与徽章。

![训练家档案](docs/profile.png)

## 两种布局

图鉴支持卡片和列表两种视图，工具栏右侧切换，选择存在 localStorage：

- **卡片**：看精灵、分类、等级，适合浏览和收集
- **列表**：一行一篇，编号、作者、会议、等级、状态一目了然，适合快速检索

![列表布局](docs/list.png)

## 论文等级

规则很简单：**不开源就是 Lv.1「常见」；开源的按 GitHub star 分级。**

| 条件 | 等级 | 段位 |
|---|---|---|
| 没有开源仓库 | Lv.1 | 常见 |
| 开源，0 star | Lv.15 | 常见 |
| 开源，10 star | Lv.34 | 稀有 |
| 开源，100 star | Lv.51 | 史诗 |
| 开源，1k star | Lv.69 | 史诗 |
| 开源，5k star | Lv.82 | 传说 |
| 开源，50k star | Lv.100 | 传说 |

```ts
level = 15 + 85 × log10(1 + stars) / log10(50001)
```

对数刻度的用意：10 star 和 100 star 的差距，应该比 10k 和 20k 的差距更明显。

等级只认「有没有代码」和「社区认不认」，不掺引用量——引用数受学科、年份和数据库覆盖影响太大，反而失真。

**同步 star**：详情页点「同步指标」。没配 `GITHUB_TOKEN` 时 GitHub API 容易触发未认证限流（60 次/时），会自动退回抓取仓库页面里的星数。

## PDF 本地化

- 原文默认放在 `data/pdfs/<arxiv>.pdf`
- 数据库只存 `url`（原始链接）和 `pdf_path`（相对路径）
- 点「下载并阅读」：本地有就直接开，没有就从 `arxiv.org/pdf/<id>` 拉一份存下来
- 服务端支持 `Range` 请求，浏览器 PDF 阅读器可以边下边翻
- `data/pdfs/` 和 `*.db` 都在 `.gitignore` 里

## 在线阅读器

点详情页的「在线阅读」，或直接访问 `/p/<id>/read`：

- **摘要**：arXiv 摘要 + 作者、会议、年份
- **原文 PDF**：`pdfjs-dist` 把 PDF 逐页渲染到 canvas，叠一层透明文字层，可以像看原版一样选字
- **总结**：模型基于全文生成 600–900 字中文总结

![PDF 阅读器](docs/reader.png)

### 高亮与批注

在 PDF 页面上选中文字，底部会浮出工具栏：四种颜色（黄 / 绿 / 蓝 / 粉）+ 批注输入框。

- 高亮按**页面归一化坐标**存储（`x/y/w/h` 都是 0–1），换屏幕、换缩放都不会错位
- 点已有高亮可以改批注、换不了颜色但能删
- 标注按用户隔离，删论文时一起删

![标注](docs/reader-text.png)

实现上：视觉层是 canvas，选区来自文字层，高亮是绝对定位的半透明色块。PDF 走 `Range` 流式加载，`pdfjs` 的 worker 单独打包、懒加载。

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Pinia + Vue Router | 深链接 `/p/<id>` |
| 后端 | Node `http` 单文件服务 | 无框架，唯一运行时依赖是 pdfjs |
| 数据库 | `node:sqlite` | Node 22+ 内置，无原生模块编译 |
| PDF 解析 | `pdfjs-dist` | 纯 JS，无需 poppler |

生产环境只有一个进程：同一个 Node 服务托管 API 和 `dist/` 静态资源。

## 快速开始

需要 **Node 22+** 和 **pnpm**。

```bash
git clone https://github.com/idejie/PokemonPaper.git
cd PokemonPaper
pnpm install
pnpm dev
```

打开 <http://127.0.0.1:5173>（Vite 会把 `/api` 代理到 8787）。

第一次打开会看到登录页，点「注册」建一个账号。**第一个注册的账号会接管仓库里自带的示例论文**，之后注册的账号从空图鉴开始。

生产模式：

```bash
pnpm build     # 类型检查 + 构建
pnpm start     # http://127.0.0.1:8787
```

> 如果 `pnpm install` 报 `ERR_PNPM_IGNORED_BUILDS: esbuild`，执行一次
> `pnpm approve-builds --all` 再装。

## 数据

- 默认库：`data/pokemonpaper.db`，首次启动自动建表并写入两条示例
- 自定义位置：`POKEMONPAPER_DB=/path/to.db pnpm start`
- 自定义端口：`PORT=9000 pnpm start`
- 可选：`GITHUB_TOKEN=ghp_xxx pnpm start`，把 GitHub API 限额从 60 次/时提到 5000
- 备份：界面右上角「导出」；恢复用「导入」，按 arXiv 号合并

`data/`、`dist/`、`node_modules/` 都在 `.gitignore` 里，不会进版本库。

## 目录结构

```
server/
  index.mjs          # HTTP API + 静态托管 + SQLite 建表/种子
src/
  core/
    sprite.ts        # 精灵生成器（纯函数，32×32，五种体型）
    palette.ts       # 分类 → 精灵配色
    arxivTaxonomy.ts # 155 个官方类目
    arxiv.ts         # arXiv 编号解析
    level.ts         # 论文等级公式
    api.ts           # API 客户端
    bibtex.ts        # BibTeX 解析（括号平衡 + 字段扫描）
    providers.ts     # 模型厂商预设
    types.ts         # Paper / TypeKey / PaperStatus / Explain
  stores/
    papers.ts        # Pinia store（列表、点亮、PDF、导入导出）
    settings.ts      # 模型配置（localStorage）
    ui.ts            # 弹窗开关
  components/
    SpriteSvg.vue    # 渲染精灵（v-for 矩形，不使用 v-html）
    PaperCard.vue    # 图鉴卡片
    PaperSheet.vue   # 详情 / 登记抽屉
    TrainerBar.vue   # 顶栏：进度、等级、导入导出、设置
    ImportDialog.vue # arXiv / BibTeX / JSON 导入
    SettingsDialog.vue # 模型厂商与 Key
    ToastHost.vue    # 提示
  views/
    DexView.vue      # 图鉴网格 + 搜索筛选
    AuthView.vue     # 登录 / 注册
  core/
    avatar.ts        # 8 个训练家头像（像素拼装）
```

## API

| 方法 | 路径 | 作用 |
|---|---|---|
| `POST` | `/api/auth/register` | 注册（邮箱 + 密码 ≥ 8 位） |
| `POST` | `/api/auth/login` | 登录 |
| `POST` | `/api/auth/logout` | 登出 |
| `GET` | `/api/auth/me` | 当前用户 |
| `PATCH` | `/api/auth/me` | 改昵称 / 头像 |
| `DELETE` | `/api/auth/me` | 注销账号（需密码） |
| `POST` | `/api/auth/password` | 改密码 |
| `GET` | `/api/auth/config` | 注册方式（open / invite） |
| `GET` `PATCH` | `/api/admin/config` | 管理员查看 / 切换注册方式 |
| `GET` `POST` | `/api/admin/invites` | 邀请码列表 / 生成 |
| `DELETE` | `/api/admin/invites/:code` | 撤销未使用的邀请码 |
| `GET` | `/api/papers` | 当前用户的列表 |
| `POST` | `/api/papers` | 新建（`title` 必填，`arxiv` 唯一） |
| `PATCH` | `/api/papers/:id` | 局部更新（状态、笔记、评分…） |
| `DELETE` | `/api/papers/:id` | 删除 |
| `POST` | `/api/arxiv/preview` | 按编号批量抓 arXiv 元数据（含分类） |
| `POST` | `/api/arxiv/search` | 按关键词搜索 arXiv（标题/摘要） |
| `POST` | `/api/papers/:id/pdf` | 确保 PDF 在本地（没有就下载） |
| `GET` | `/api/papers/:id/pdf` | 流式返回 PDF（支持 Range） |
| `POST` | `/api/explain` | 调模型生成速读卡（配置随请求传入） |
| `POST` | `/api/papers/:id/metrics` | 同步 GitHub star |
| `GET` `POST` | `/api/papers/:id/text` | 读取 / 提取全文（供总结用） |
| `GET` `POST` | `/api/papers/:id/annotations` | 标注列表 / 新建 |
| `PATCH` `DELETE` | `/api/annotations/:id` | 改批注 / 删除 |
| `GET` `POST` | `/api/papers/:id/summary` | 读取 / 生成总结 |
| `GET` | `/api/export` | 全量导出 JSON |
| `POST` | `/api/import` | 按 arXiv 合并导入 |
| `POST` | `/api/papers/backfill` | 为缺分类的老论文补 arXiv 元数据 |
| `GET` | `/api/health` | 健康检查 |

## 数据模型

```ts
interface User {
  id: string
  email: string
  name: string
  avatarId: string      // 8 个预设头像之一
  isAdmin: boolean      // 第一个注册的账号自动成为管理员
  passwordHash: string  // scrypt$salt$hash
  createdAt: string
}

interface Invite {
  code: string          // 8 位一次性邀请码
  createdBy: string
  usedBy: string | null
}

interface Paper {
  id: string
  arxiv: string          // 编号，唯一，同时是精灵种子
  title: string
  authors: string
  venue: string
  year: number | null
  primaryCategory: string // 例如 cs.RO
  categories: string[]    // arXiv 可能给多个类目
  status: 'unread' | 'reading' | 'read'
  rating: number         // 0–5
  tags: string           // 逗号分隔
  notes: string
  abstract: string       // arXiv 摘要
  explain: string        // AI 速读卡的 JSON 字符串
  pdfPath: string        // 相对 data/pdfs/ 的文件名，空表示未下载
  codeUrl: string        // 开源仓库，空表示未开源
  stars: number          // GitHub stars
  metricsAt: string | null
  url: string
  addedAt: string
  readAt: string | null
  userId: string        // 归属账号，所有查询按它隔离
}
```

## 路线图

- [x] 粘贴 arXiv 链接自动抓取标题 / 作者 / 摘要
- [x] 批量导入（arXiv / BibTeX / JSON）
- [x] PDF 本地化与 Range 流式阅读
- [x] AI 速读卡（OpenAI 兼容，预设 DeepSeek 等）
- [x] 论文等级：开源 + star
- [x] 改密码
- [x] 管理员 + 邀请码
- [x] 注销账号与数据导出
- [ ] 邮件找回密码
- [ ] 指标定时刷新（现在要手点）
- [ ] 批量下载缺失 PDF（后台队列 + 进度）
- [ ] 点亮动效：卡片弹跳 + 经验条增长 + 音效
- [x] 训练家等级（XP / 称号 / 徽章）
- [x] 卡片与列表两种布局
- [x] PDF 阅读器（渲染 + 高亮 + 批注）
- [ ] 跨页选择与标注列表
- [ ] PDF 内搜索
- [ ] 统计页：按分类、年份、会议分布
- [ ] 解读导出为 Markdown / 独立 HTML 精读页
- [ ] 多人共用（当前是单机单用户）

## 已知限制

- 没有邮箱验证、找回密码和 OAuth（改密码已有，但忘了就进不去）
- 会话存在 SQLite，多实例部署需要共享数据库
- AI 解读质量取决于所选模型；摘要信息不足时它应该留空，但小模型仍可能脑补
- 批量下载 PDF 还没做，目前是一篇一篇点
- star 来自 GitHub，有分钟级延迟
- 等级是影响力代理，不代表论文质量——新论文天然吃亏
- 扫描版 PDF 没有文字层，无法选中标注，总结也只能靠摘要
- PDF 内搜索按文本层片段匹配，跨片段的短语可能漏
- 跨页选择暂不支持，一次标注请在同一页内
- 精灵生成器是模板式的，形状会有重复，但配色和细节组合足够区分
- 未做全文检索，只搜已录入的字段

## License

[MIT](LICENSE) © 2026 idejie
