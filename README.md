# Right Search

一个基于 Manifest V3 的 Chrome 扩展：在网页中选中文本后，通过右键菜单使用自定义搜索引擎快速搜索。

## 功能特性

- 仅在选中文本时显示右键菜单，减少无关干扰。
- 支持多搜索引擎配置，并可启用/禁用单个引擎。
- 支持在选项页新增、编辑、删除、排序搜索引擎。
- 使用 `{q}` 作为查询占位符，自动替换为当前选中文本并进行 URL 编码。
- 配置持久化到 `chrome.storage.sync`，可随浏览器账户同步。
- 打开搜索结果时在当前标签页右侧新建标签页。

默认内置搜索引擎：Google、Bing、百度、GitHub、Stack Overflow。

## 环境要求

- Node.js 18+（推荐）
- Chrome 浏览器（支持 Manifest V3）

## 安装与构建

```bash
npm install
npm run build
```

开发时可使用监听构建：

```bash
npm run watch
```

清理编译产物：

```bash
npm run clean
```

## 在 Chrome 中加载扩展

1. 打开 `chrome://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择仓库根目录。
4. 修改源码后重新执行构建（或保持 `npm run watch`），并在扩展页面点击“刷新”。

## 使用说明

### 1. 右键搜索

1. 在任意网页中选中一段文本。
2. 右键选择“右键搜索”。
3. 点击某个搜索引擎后，会在当前标签页右侧打开搜索结果页。

### 2. 配置搜索引擎

1. 进入扩展“详情”页，打开“扩展程序选项”。
2. 在选项页可进行新增、编辑、拖拽排序、上下移动、删除、启用/禁用。
3. 点击“保存”将配置写入同步存储。
4. 点击“重置”可恢复默认引擎列表。

新增引擎时 URL 必须包含 `{q}`，例如：

```text
https://example.com/search?q={q}
```

## 项目结构

```text
.
├── src/
│   ├── background.ts          # Service Worker：右键菜单、搜索打开、存储监听
│   ├── options.ts             # 选项页逻辑：增删改查、排序、保存/重置
│   ├── component/Modal.ts     # 确认弹窗组件
│   └── types.ts               # 类型定义、默认引擎、存储键
├── dist/                      # TypeScript 编译输出
├── options.html               # 选项页
└── manifest.json              # 扩展清单
```

> 请在 `src/` 中修改源码并重新构建，不要手动编辑 `dist/` 下编译产物。

## 手动验证清单

- `npm run build` 可以成功完成。
- 仅在选中文本时显示右键菜单。
- 已启用搜索引擎能正确打开 URL，且 `{q}` 被替换为查询词。
- 选项页的新增、编辑、排序、删除、保存、重置后，数据可通过 `chrome.storage.sync` 正确持久化。

## 权限说明

`manifest.json` 当前使用以下权限：

- `contextMenus`：创建右键菜单。
- `storage`：保存/同步搜索引擎配置。
- `tabs`：在当前窗口创建搜索结果标签页。

## License

MIT
