# 项目文档

`pi-sakura-cyberdeck` 是一个由 Pi 直接加载的视觉增强包，包含：

- `sakura-macaron` 真彩色主题；
- Sakura → Sky 渐变的 Cyberdeck 会话启动 Header；
- 动态 Zentui Footer，用于展示项目、Git、运行时和会话状态。

项目不会替换或固定 Pi 的编辑器组件。扩展源码由 Pi 直接加载，不存在单独的构建产物或常驻服务。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [快速开始](getting-started.md) | 环境要求、安装、启用、升级与卸载 |
| [Footer 使用指南](footer.md) | 状态段、`/zentui`、模板语法、变量和布局规则 |
| [配置参考](configuration.md) | 配置路径、完整字段、默认行为、颜色和图标 |
| [架构说明](architecture.md) | 模块职责、生命周期、状态流、刷新与错误策略 |
| [主题与 Header](theme-and-header.md) | 配色结构、主题选择、Header 渲染和品牌定制 |
| [开发与发布](development.md) | 仓库结构、本地开发、检查、发布和扩展约定 |
| [故障排查](troubleshooting.md) | 常见显示、配置、Git、运行时和性能问题 |

## 功能概览

### Theme

`themes/sakura-macaron.json` 定义 Pi 所需的消息、Markdown、工具、Diff、语法高亮和思考等级颜色，并为导出页面提供背景颜色。

### Header

`extensions/header/index.ts` 在 `session_start` 时安装启动 Header，在 `session_shutdown` 时清理。Header 使用 24-bit ANSI RGB 渐变，并按终端宽度裁剪、按可用行数增加顶部留白。

### Zentui Footer

`extensions/zentui/` 提供：

- 当前目录、用户名、操作系统和时间；
- Git 分支、工作区状态、ahead/behind、操作状态、提交、标签和行数变化；
- 运行时及本机工具链版本；
- 项目清单版本；
- Context 占用、Token 汇总、Cache read/write/hit 和费用；
- Session 名称、Turn、Model、Thinking level 和会话时长；
- Codex subscription usage、MCP 连接数和 Pi 配置统计；
- Tool 完成/运行状态与主 Agent run 活动；
- 其他扩展通过 Pi 状态 API 发布的状态；
- 内置布局与自定义 Footer 模板；
- Nerd Font、ASCII 图标和可覆盖图标；
- Pi 主题色或终端 ANSI/Truecolor 样式。

## 关键边界

- Footer 和交互设置仅在带 UI 的 TUI 会话中工作。
- Runtime 与项目版本只检查当前工作目录顶层，不向父目录递归。
- Git 和 Runtime 检测会执行本机命令；项目版本检测只读取清单文件。
- Codex usage 会访问固定 ChatGPT endpoint，并可能启动本机 `codex app-server` fallback。
- 多个扩展若同时调用 `ctx.ui.setHeader()` 或 `ctx.ui.setFooter()`，会竞争同一 UI 区域。
- 当前仓库提供包级静态检查（`npm run check`）与基于 Node 原生 TypeScript strip-types 的逻辑测试（`npm test`），但没有类型检查、Lint 或 CI 配置。

## 版本与许可证

- 包版本：见根目录 `package.json`。
- 许可证：MIT，见 [`LICENSE`](../LICENSE)。
- Zentui 衍生代码归属：见 [`NOTICE`](../NOTICE) 和 [`licenses/pi-zentui-MIT.txt`](../licenses/pi-zentui-MIT.txt)。
