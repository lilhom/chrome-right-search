# 仓库指南

## 项目结构与模块组织
这是一个使用 TypeScript 编写的 Manifest V3 Chrome 扩展。

- `src/background.ts`：Service Worker 逻辑（右键菜单创建、搜索标签页打开、存储同步更新）。
- `src/options.ts`：选项页行为，用于管理自定义搜索引擎。
- `src/component/Modal.ts`：可复用的确认弹窗 UI 逻辑。
- `src/types.ts`：共享类型、默认值和存储键常量。
- `manifest.json`：扩展配置与权限。
- `options.html`：选项页标记与样式。
- `dist/`：由 TypeScript（`tsc`）编译生成的 JavaScript 输出。

请在 `src/` 中修改源码并重新构建；不要手动编辑 `dist/` 下的编译产物。

## 构建、测试与开发命令
- `npm install`：安装依赖。
- `npm run build`：将 TypeScript 编译到 `dist/`。
- `npm run watch`：开发时进行增量编译。
- `npm run clean`：删除 `dist/` 以进行干净重建。

典型本地流程：
1. 运行 `npm run build`。
2. 在 Chrome（`chrome://extensions`）中将该目录作为“已解压的扩展程序”加载。
3. 源码变更后重新加载扩展（或持续运行 `npm run watch`）。

## 代码风格与命名规范
- 启用 `strict` 模式的 TypeScript（见 `tsconfig.json`）；对 Chrome API 数据保持显式类型。
- 使用 2 空格缩进和分号，并与现有文件风格保持一致。
- 变量/函数使用 `camelCase`，类型/类使用 `PascalCase`，常量使用 `UPPER_SNAKE_CASE`。
- 保持模块职责单一：后台逻辑放在 `background.ts`，UI 行为放在 `options.ts`，共享契约放在 `types.ts`。
- 将用户可控文本注入 HTML 前务必进行转义（沿用已有 `escapeHtml` 模式）。

## 测试指南
目前尚无自动化测试。提交 PR 前请进行手动验证：

- `npm run build` 构建通过。
- 仅在选中文本时出现右键菜单。
- 已启用搜索引擎能正确打开 URL，并用 `{q}` 替换查询词。
- 选项页的新增/编辑/排序/删除/保存/重置流程通过 `chrome.storage.sync` 正确持久化。

## 提交与 Pull Request 指南
- 尽量遵循 Conventional Commits（`feat:`、`fix:`、`refactor:`、`docs:`）；当前历史已采用该规范。
- 保持提交聚焦，单个提交只解决一个关注点。
- PR 应包含：
  - 简洁的变更摘要与动机，
  - 手动验证步骤，
  - 涉及选项页 UI 变更时的截图/GIF，
  - 明确说明任何权限或 manifest 更新。

## 安全与配置建议
- 保持最小权限原则（当前为 `contextMenus`、`storage`、`tabs`）。
- 保持对 MV3 Service Worker 约束与异步错误处理的遵循。
- 不要提交密钥或用户数据；配置应保留在受版本控制的 manifest/默认选项中。
