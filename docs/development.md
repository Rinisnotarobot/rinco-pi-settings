# 开发与发布

## 仓库结构

```text
.
├── extensions/
│   ├── header/
│   │   └── index.ts
│   └── zentui/
│       ├── index.ts
│       ├── config.ts
│       ├── footer.ts
│       ├── footer-layout.ts
│       ├── footer-format.ts
│       ├── format.ts
│       ├── state.ts
│       ├── git.ts
│       ├── runtime.ts
│       ├── package-version.ts
│       ├── extension-status.ts
│       ├── telemetry.ts
│       ├── skill-activity.ts
│       ├── config-counts.ts
│       ├── mcp-status.ts
│       ├── codex-usage/          # Codex 订阅用量客户端（衍生自 pi-codex-usage）
│       │   ├── index.ts
│       │   ├── query.ts
│       │   ├── app-server-client.ts
│       │   ├── normalize.ts
│       │   ├── format.ts
│       │   ├── safety.ts
│       │   ├── types.ts
│       │   └── LICENSE
│       ├── project-state.ts
│       ├── project-refresh.ts
│       ├── live-context.ts
│       ├── session-lifecycle.ts
│       ├── settings-command.ts
│       ├── icons.ts
│       └── style.ts
├── themes/
│   └── sakura-macaron.json
├── scripts/
│   └── check.mjs
├── tests/
│   ├── zentui-status.test.ts
│   └── codex-usage.test.ts
├── docs/
├── licenses/
├── package.json
├── README.md
├── NOTICE
├── LICENSE
└── .gitignore
```

## 依赖模型

Peer dependencies：

```json
{
  "@earendil-works/pi-coding-agent": "*",
  "@earendil-works/pi-tui": "*"
}
```

源码还从 `@earendil-works/pi-ai` 导入类型/消息能力，但根 manifest 未直接声明它，当前依赖宿主依赖树提供。

项目没有普通 `dependencies` / `devDependencies`、lockfile、`tsconfig.json`、Lint/Formatter 配置或 CI。当前使用 Node 24 原生 TypeScript strip-types 运行纯逻辑测试，并结合包结构检查与真实 Pi TUI 手工验收。

## 本地开发流程

1. 修改 `extensions/**/*.ts` 或 `themes/sakura-macaron.json`；
2. 运行静态检查；
3. 运行 npm 打包预览；
4. 通过本地路径安装；
5. 在不同终端宽度和项目类型中手工验证。

```bash
npm test
npm run check
npm run pack:check
pi install ./pi-sakura-cyberdeck
```

扩展由 Pi 直接加载 TypeScript，不需要先生成 JavaScript。

## 当前检查覆盖

```bash
npm run check
```

`scripts/check.mjs` 检查：

- 包名；
- `pi-package` keyword；
- 扩展注册表是否准确；
- 注册的扩展和主题是否存在；
- 已移除功能的路径不存在；
- Zentui 入口不包含旧 Editor 生命周期标记；
- 主题名和必需颜色键完整。

它**不检查**：

- TypeScript 类型；
- `npm test` 之外的生命周期和真实 TUI 集成；
- 模板、Git、Runtime、Package parser 的行为；
- JSON Schema 在线有效性；
- Pi 是否能在真实 TUI 中加载；
- ANSI、Unicode 和可见宽度效果。

```bash
npm run pack:check
```

执行 `npm pack --dry-run`，用于确认发布白名单。`package.json#files` 当前包含：

```text
extensions, themes, licenses, scripts, docs, README.md, LICENSE, NOTICE
```

`docs/` 已包含在 npm 发布包中。仓库安装方式不受该白名单影响。

## 自动测试

```bash
npm test
```

当前覆盖 Footer 分类左对齐三行布局与窄宽度预算、Telemetry 的并发 Tool ID 关联、记录上限、target 清洗、Agent run、Skill 发现/激活与 Session branch 恢复、配置统计容错、MCP 文本解析，以及 Codex payload 规范化和模型专属额度格式化。测试不发网络请求，也不启动 Codex CLI。

## 手工测试矩阵

### UI

- 宽终端、80 列、极窄终端；
- truecolor 和降级终端；
- Nerd Font 与普通字体；
- `auto`、`nerd`、`ascii` 图标；
- Header 在不同 terminal rows 下的垂直留白；
- Footer 启用、停用和重新启用。

### Session

- 模型切换；
- 流式回复；
- Agent 开始/结束；
- 工具调用前后；
- Session compact 和 tree 切换；
- Shutdown 后无残留定时器/状态行。

### 项目状态

- 非 Git 目录；
- 干净和 dirty 仓库；
- ahead/behind、stash、冲突；
- detached HEAD 和精确 Tag；
- rebase/merge/cherry-pick；
- 大仓库命令超时；
- cwd 切换，确认不会显示旧状态；
- 多 Runtime 清单同时存在；
- 清单存在但版本命令不存在；
- 支持/不支持/动态 Package version。

### 配置

- 无文件；
- 部分字段；
- 未知字段；
- 非法颜色和超范围数字；
- 损坏 JSON；
- 符号链接配置；
- 文件权限保留；
- 自定义模板无/一/二/多个 `$fill`；
- 嵌套和空条件组。

## 代码约定

### 生命周期与副作用

- 将事件监听和副作用编排保留在 `extensions/zentui/index.ts`；
- 不在 Footer `render()` 中执行文件读写或子进程；
- 异步结果写入前检查 Session generation；
- 定时器应在 shutdown 清理，并尽可能 `unref()`。

### 新增状态采集器

- 返回显式 `ok` / `error` / `not found` 语义；
- 区分“确实不存在”和“暂时读取失败”；
- 同一 cwd 沿用 last-good，切换 cwd 清理旧值；
- 对外部命令设置合理超时；
- 避免递归或每帧扫描。

### 新增 Footer 变量

至少同步修改：

1. `config.ts` 的 `FOOTER_FORMAT_VARIABLES`；
2. 必要时增加 alias；
3. `footer.ts` 的 `renderVariable`；
4. 项目刷新中的按需探测逻辑；
5. `/zentui` 文案或状态段设置；
6. `docs/footer.md` 和 `docs/configuration.md`。

### 新增配置字段

至少补充：

1. TypeScript 类型；
2. 默认值；
3. parse/normalize；
4. `mergeConfig()`；
5. 保存 patch 的白名单；
6. 交互设置入口（如适用）；
7. 文档和测试用例。

### ANSI 与宽度

- 使用 `visibleWidth()`、`truncateToWidth()`；
- 复用 `renderStyleForSource()`；
- 不将字符串 `.length` 直接当作终端 cell 宽度；
- 外部状态必须经过现有 sanitize 函数。

## 发布

发布前：

```bash
npm run check
npm run pack:check
npm publish --access public
```

建议额外确认：

- `package.json#version` 已更新；
- `README.md` 安装地址不是占位符；
- `repository`、`homepage`、`bugs` 元数据已补齐；
- 若发布详细文档，`docs` 已加入 `files`；
- `NOTICE` 与上游许可证保留；
- 在受支持的 Pi 版本中完成手工回归；
- `npm pack --dry-run` 输出不含开发垃圾或敏感文件。

若要在 Pi package gallery 展示图片，可在 `package.json` 的 `pi` 字段增加托管 PNG/WebP URL，例如：

```json
{
  "pi": {
    "image": "https://example.com/pi-sakura-cyberdeck.webp"
  }
}
```

## 已知工程缺口

后续可优先补充：

1. TypeScript 配置和类型检查脚本；
2. 模板、格式化、配置归一化和 parser 单元测试（telemetry、config-counts、codex-usage、package-version、mcp-status 已有覆盖）；
3. Git/Runtime 刷新集成测试；
4. CI；
5. 固定或约束 Peer 兼容范围；
6. 直接声明 `@earendil-works/pi-ai` 或移除直接依赖；
7. Changelog、贡献指南和发布策略；
8. 截图及不同终端宽度示例。
