<div align="center">

# PokemonPaper

**把每篇论文变成一只宝可梦。编号就是 arXiv 号，读完点亮。**

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003b57?style=flat-square)](https://nodejs.org/api/sqlite.html)
[![License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](LICENSE)

[快速开始](#快速开始) · [设计](#三个设计决定) · [目录](#目录结构) · [路线图](#路线图)

</div>

![PokemonPaper 界面](docs/preview.png)

---

## 这是什么

读论文最难的不是读，是**记得自己读过什么**。PokemonPaper 把这件事做成收集游戏：

- 登记一篇论文，它变成一只精灵
- 没读的时候是灰色剪影，读的时候是半彩，读完**点亮**
- 编号就是 arXiv 号——`No.2610.28480` 永远是同一只
- 收集进度、训练家等级、按属性分色

数据全部留在本地 SQLite，不上云。

## 特性

| | |
|---|---|
| 🧬 **确定性精灵** | 同一 arXiv 号在任何设备、任何时候生成同一只，纯函数 + 固定种子 |
| 📥 **批量导入** | 一行一个 arXiv 编号或链接，最多 50 篇；也支持 BibTeX 和 JSON 备份 |
| 🏷️ **arXiv 即主键** | 粘贴 `https://arxiv.org/pdf/2610.28480` 自动提取编号；重复登记会被拒绝 |
| 🌗 **三态点亮** | 未读剪影 → 在读半彩 → 已读全彩 + 金星 |
| 🤖 **AI 速读卡** | 一句话 / 问题 / 方法 / 关键数字 / 局限 / 下一步，OpenAI 兼容接口，Key 存本地 |
| 📄 **PDF 本地化** | 原文存 `data/pdfs/`，库里只记链接和相对路径；没有就从 arXiv 现下 |
| 🔍 **检索** | 标题 / 作者 / 编号 / 标签 / 会议全文搜索，`/` 聚焦 |
| 💾 **可迁移** | 一键导出 JSON，按 arXiv 号合并导入 |

## 三个设计决定

### 1. 编号即身份

arXiv 号自带时间信息（`2610` = 2026 年 10 月），既是业务主键，也是排序依据，也是精灵种子。数据库里 `arxiv` 是 `UNIQUE`，重复登记返回 `409`。

### 2. 精灵必须可复现

```ts
buildSprite(seed: string, type: TypeKey, locked: boolean): SpriteRect[]
```

输入一个字符串，输出 16×16 的矩形数组。只用 FNV-1a hash + mulberry32，**没有 `Math.random()`**。所以 `2610.28480` 在任何机器上都是同一只。

生成器不碰 DOM，换框架只换渲染层。

### 3. 游戏状态是阅读状态

没有签到、没有连击、没有虚拟货币。点亮只有一条路径：你真的把它读完了。未读的剪影和已读的全彩之间，只差一个诚实的点击。

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

## PDF 本地化

- 原文默认放在 `data/pdfs/<arxiv>.pdf`
- 数据库只存 `url`（原始链接）和 `pdf_path`（相对路径）
- 点「下载并阅读」：本地有就直接开，没有就从 `arxiv.org/pdf/<id>` 拉一份存下来
- 服务端支持 `Range` 请求，浏览器 PDF 阅读器可以边下边翻
- `data/pdfs/` 和 `*.db` 都在 `.gitignore` 里

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Pinia + Vue Router | 深链接 `/p/<id>` |
| 后端 | Node `http` 单文件服务 | 零运行时依赖 |
| 数据库 | `node:sqlite` | Node 22+ 内置，无原生模块编译 |

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
- 备份：界面右上角「导出」；恢复用「导入」，按 arXiv 号合并

`data/`、`dist/`、`node_modules/` 都在 `.gitignore` 里，不会进版本库。

## 目录结构

```
server/
  index.mjs          # HTTP API + 静态托管 + SQLite 建表/种子
src/
  core/
    sprite.ts        # 精灵生成器（纯函数，16×16 确定性像素）
    typeMap.ts       # 10 种属性定义 + 关键词猜测
    arxiv.ts         # arXiv 编号解析
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
```

## API

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/api/papers` | 列表 |
| `POST` | `/api/papers` | 新建（`title` 必填，`arxiv` 唯一） |
| `PATCH` | `/api/papers/:id` | 局部更新（状态、笔记、评分…） |
| `DELETE` | `/api/papers/:id` | 删除 |
| `POST` | `/api/arxiv/preview` | 按编号批量抓 arXiv 元数据 |
| `POST` | `/api/papers/:id/pdf` | 确保 PDF 在本地（没有就下载） |
| `GET` | `/api/papers/:id/pdf` | 流式返回 PDF（支持 Range） |
| `POST` | `/api/explain` | 调模型生成速读卡（配置随请求传入） |
| `GET` | `/api/export` | 全量导出 JSON |
| `POST` | `/api/import` | 按 arXiv 合并导入 |
| `GET` | `/api/health` | 健康检查 |

## 数据模型

```ts
interface Paper {
  id: string
  arxiv: string          // 编号，唯一，同时是精灵种子
  title: string
  authors: string
  venue: string
  year: number | null
  type: TypeKey          // normal/fire/water/grass/electric/psychic/ghost/steel/dark/dragon
  status: 'unread' | 'reading' | 'read'
  rating: number         // 0–5
  tags: string           // 逗号分隔
  notes: string
  abstract: string       // arXiv 摘要
  explain: string        // AI 速读卡的 JSON 字符串
  pdfPath: string        // 相对 data/pdfs/ 的文件名，空表示未下载
  url: string
  addedAt: string
  readAt: string | null
}
```

## 路线图

- [x] 粘贴 arXiv 链接自动抓取标题 / 作者 / 摘要
- [x] 批量导入（arXiv / BibTeX / JSON）
- [x] PDF 本地化与 Range 流式阅读
- [x] AI 速读卡（OpenAI 兼容，预设 DeepSeek 等）
- [ ] 批量下载缺失 PDF（后台队列 + 进度）
- [ ] 点亮动效：卡片弹跳 + 经验条增长 + 音效
- [ ] 统计页：按属性、年份、会议分布
- [ ] 解读导出为 Markdown / 独立 HTML 精读页
- [ ] 多人共用（当前是单机单用户）

## 已知限制

- 单用户、单机，没有登录
- AI 解读质量取决于所选模型；摘要信息不足时它应该留空，但小模型仍可能脑补
- 批量下载 PDF 还没做，目前是一篇一篇点
- 精灵生成器是模板式的，形状会有重复，但配色和细节组合足够区分
- 未做全文检索，只搜已录入的字段

## License

[MIT](LICENSE) © 2026 idejie
