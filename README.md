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
| 🏷️ **arXiv 即主键** | 粘贴 `https://arxiv.org/pdf/2610.28480` 自动提取编号；重复登记后端直接拒绝 |
| 🌗 **三态点亮** | 未读剪影 → 在读半彩 → 已读全彩 + 金星 |
| 🔍 **检索** | 标题 / 作者 / 编号 / 标签 / 会议全文搜索，`/` 聚焦 |
| 📝 **笔记与评分** | 每篇可写一句话结论，五星评分，标签分类 |
| 💾 **可迁移** | 一键导出 JSON，按 arXiv 号合并导入 |
| 📱 **响应式** | 桌面多列图鉴，手机两列 |

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
    types.ts         # Paper / TypeKey / PaperStatus
  stores/
    papers.ts        # Pinia store（列表、点亮、导入导出）
  components/
    SpriteSvg.vue    # 渲染精灵（v-for 矩形，不使用 v-html）
    PaperCard.vue    # 图鉴卡片
    PaperSheet.vue   # 详情 / 登记抽屉
    TrainerBar.vue   # 顶栏：进度、等级、导入导出
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
  url: string
  addedAt: string
  readAt: string | null
}
```

## 路线图

- [ ] 粘贴 arXiv 链接自动抓取标题 / 作者 / 摘要（`export.arxiv.org/api/query` 支持 CORS）
- [ ] 点亮动效：卡片弹跳 + 经验条增长 + 音效
- [ ] 统计页：按属性、年份、会议分布
- [ ] 标签管理（现在是自由文本）
- [ ] 多人共用（当前是单机单用户）

## 已知限制

- 单用户、单机，没有登录
- 精灵生成器是模板式的，形状会有重复，但配色和细节组合足够区分
- 未做全文检索，只搜已录入的字段

## License

[MIT](LICENSE) © 2026 idejie
