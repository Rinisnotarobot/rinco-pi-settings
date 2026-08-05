# 故障排查

## 主题没有出现

检查：

1. 包是否通过 Pi package 方式正确安装；
2. 安装内容是否包含 `themes/sakura-macaron.json`；
3. 根 `package.json#pi.themes` 是否注册该文件；
4. `/settings` 中是否选择 `sakura-macaron`；
5. 是否重新进入会话；
6. 终端是否支持 truecolor。

源码仓库可运行：

```bash
npm run check
```

## Header 不显示

- Header 只在 `ctx.hasUI=true` 的会话安装；
- 另一个 Header 扩展可能覆盖 `ctx.ui.setHeader()`；
- 极窄终端会大量裁剪图案；
- 检查 `extensions/header/index.ts` 是否被包清单注册；
- 新建 Session，确认 `session_start` 重新触发。

## Footer 不显示

运行：

```text
/zentui statusline enable
```

然后检查：

- 当前是否为 Pi TUI；
- 配置中的 `features.statusLine` 是否为 `true`；
- 是否有另一个扩展调用 `ctx.ui.setFooter()`；
- 配置 JSON 是否有效；
- 新建会话后是否恢复。

Headless / 非 TUI 模式不会安装 Footer，`/zentui` 的交互界面也不会打开。

## 图标乱码、方框或错位

将图标模式切换为 `ascii`：

```text
/zentui
Layout → Icon mode → ascii
```

或在配置中：

```json
{ "icons": { "mode": "ascii" } }
```

`auto` 当前不会探测字体能力，它与 `nerd` 一样使用 Nerd glyph。

## 颜色不正确

1. 确认终端支持 truecolor；
2. 检查 `$TERM`、`$COLORTERM` 和 tmux/screen 配置；
3. 在 `/zentui` 的 **Coloring** 中尝试 `theme` 和 `terminal`；
4. 手工配置时确保颜色格式受支持；
5. 主题模式下，命名 ANSI 色会映射到近似 Pi theme token，不保证与终端模式完全一致。

合法示例：

```text
bold #F2A7C6
fg:202
bg:blue underline
accent
```

## `/zentui` 设置无法保存

若出现类似：

```text
Refusing to save Zentui config because ... is corrupt or unreadable
```

说明配置文件不是合法 JSON object、不可读，或符号链接目标有问题。先备份：

```bash
cp ~/.pi/agent/sakura-cyberdeck-zentui.json \
  ~/.pi/agent/sakura-cyberdeck-zentui.json.bak
```

再修复 JSON，或删除文件恢复默认：

```bash
rm ~/.pi/agent/sakura-cyberdeck-zentui.json
```

注意：启动加载失败会静默回退，通常到保存时才显示错误。

## 手工改配置后没有变化

配置在 `session_start` 加载。通过 `/zentui` 修改会更新当前内存配置并请求重绘；外部编辑器直接改文件后，应新建或重启 Session。

## Git 信息缺失

检查：

```bash
git rev-parse --is-inside-work-tree
git status --porcelain=2 --branch
git stash list
```

常见原因：

- 当前 cwd 不是 Git worktree；
- `git` 不在 `PATH`；
- Git 命令超过 2 秒；
- 对应状态段关闭；
- 自定义模板未引用 Git 变量；
- cwd 是仓库外层目录，检测不会向子目录寻找仓库。

同一 cwd 瞬时错误会保留上次成功结果；切换 cwd 会清理旧 Git 状态。

## Commit、Tag 或 Metrics 不显示

- `gitCommit` 和 `gitMetrics` 默认关闭；
- `gitCommit.onlyDetached=true` 时普通分支不显示独立 Commit 段；
- Tag 仅显示精确匹配当前 `HEAD` 的 Tag；
- `gitMetrics.onlyNonzero=true` 时零变化隐藏；
- 模板应使用 `$git_commit`、`$git_tag`、`$git_metrics` 等变量；
- 这些信息按需探测，未启用或未引用就不会执行额外命令。

## Runtime 有图标但没有版本

说明项目类型已被顶层文件/目录检测到，但版本命令：

- 不在 `PATH`；
- 返回非零状态；
- 输出格式不匹配；
- 超过 2.5 秒。

Footer 会保留 Runtime 标识并省略版本，这是预期降级。

## Runtime 识别错误

- 检测只看当前 cwd 顶层；
- 多个清单同时存在时按优先级选择；
- Monorepo 根目录和子包目录可能得到不同结果；
- 切换到实际项目目录后等待刷新，或在工具/消息事件后重新观察；
- 最坏情况下关闭 Runtime 状态段。

## Package version 不显示

1. `packageVersion` 默认关闭；
2. 开启该状态段，或模板使用 `$package` / `$package_version`；
3. 清单必须位于当前 cwd 顶层；
4. 版本声明必须是支持的静态形式；
5. 动态脚本、变量引用或不受支持的 workspace 语法可能无法解析。

Package version 与本机 Runtime version 不同，详见 [Footer 使用指南](footer.md)。

## Context 不实时更新

- 流式消息只有带 usage 时才能估算实时 Context；
- 更新按约 250ms 合并；
- error/aborted 消息会清理 live override；
- 无模型 `contextWindow` 时只能依赖 Pi 的 `getContextUsage()`；
- Compact 或 Session tree 变化后会重新同步。

## Token 或费用不正确

Token 和费用从当前 Session 的 Assistant entries 累计，不是系统级用量：

- Provider 未提供 usage/cost 时可能为空或偏少；
- Compact、tree 切换会使缓存失效并重新计算；
- 流式期间的最终累计值可能到 `message_end` 后才稳定；
- Cache hit 使用最新 Assistant usage，不等于整个 Session 的全局平均。

## Footer 刷新慢

默认项目周期刷新约 30 秒，且事件刷新受 5 秒节流。以下事件也会触发刷新：

- Agent 结束；
- Message 结束；
- Tool execution 结束；
- Session compact/tree 变化；
- Git branch change。

可在配置中调整：

```json
{ "projectRefreshIntervalMs": 10000 }
```

最小有效正间隔为 5000ms。设为 `0` 只关闭周期刷新，不关闭事件刷新。

## Codex usage 一直 checking 或 usage error

自动查询仅在当前 Provider 为 `openai-codex` 时运行。依次检查：

1. Pi 是否已通过 `/login` 配置 OpenAI ChatGPT Plus/Pro Codex Auth；
2. 网络能否访问 `https://chatgpt.com/backend-api/wham/usage`；
3. 若直连 Auth 不可用，`codex` 是否在 `PATH` 且已执行 `codex login`；
4. 运行 `/codex-status --refresh --timeout 30` 查看脱敏后的详细错误；
5. 切换离开 Codex Model 时状态会切换为对应 Provider 的额度，或自动清除，这是预期行为。

## Token Switch 一直 checking balance 或 balance error

自动查询仅在当前 Provider 为 `token-switch` 时运行。依次检查：

1. 启动 Pi 的环境中是否设置了 `TOKEN_SWITCH_API_KEY`；
2. 网络能否访问 `https://neolink.com/backend/v1/dashboard/billing/subscription`；
3. API Key 是否有效，subscription 响应是否包含非负数值 `hard_limit_usd`，usage 响应是否包含非负数值 `total_usage`；
4. 不要使用缺少 `/backend/` 前缀的地址，该地址会返回 SPA HTML；
5. 修改环境变量后重启 Pi，再切换到 Token Switch Model 触发查询；
6. 已在会话中时可直接运行 `/usage-refresh` 强制重新查询余额。

## MCP 数量没有显示

专用 MCP 段解析文本格式 `MCP: connected/total servers`。如果 MCP adapter 使用不同 key 或格式，解析会失败，但原始扩展 status 应继续显示。检查 `footerSegments.mcp` 是否开启，以及窄终端是否有足够空间。

## Tool 或 Agent 活动不符合预期

- Tool 计数只累计成功完成的 `read/write/edit/bash/grep/ls/find`；
- Error Tool 不进入完成计数；
- Running Tool 最多显示最近两个；
- Tool target 只读取 `args.path` 或 `args.filePath`；
- Agent activity 是主 Agent loop 数，不是 Subagent 数；Subagent 状态由相应扩展发布。

## Footer 在窄终端丢内容

这是设计行为。空模板的分类三行全部左对齐并分别计算宽度预算；某一行内容放不下时会在行末安全截断，其他扩展状态只使用第二行剩余预算。非空 `footerFormat` 仍按兼容的单行规则布局。

建议：

- 关闭 `username`、`sessionDuration`、`packageVersion`、`gitMetrics`、`configCounts` 等非必要段；
- 缩短分支长度；
- 使用 basename 路径；
- 使用更短模板；
- 将 Context 改为 `gauge` 或 `text`；
- 隐藏不需要的扩展状态。

## 其他扩展状态不显示

- 该状态必须当前正通过 Pi 状态 API 发布；
- `/zentui` 的 Extension segments 只列出活跃状态；
- placement 不能是 `off`；
- 空内容、纯控制序列会被过滤；
- 窄终端可能没有足够宽度；
- 同位置状态按 key 排序，并按宽度依次加入。

## `npm run check` 通过但运行仍失败

当前检查只是结构和主题字段断言，不执行 TypeScript 类型检查或真实 Pi 加载。继续检查：

```bash
npm run pack:check
```

然后查看 dry-run 包内容，并通过本地路径在目标 Pi 版本中安装测试。尤其确认宿主依赖树能提供源码导入的所有 `@earendil-works/*` 包。

## 收集问题信息

报告问题时建议提供：

- Pi 版本；
- 包版本和安装来源；
- 操作系统、终端、字体；
- 终端宽度；
- 脱敏后的 Zentui 配置；
- 当前 cwd 是否 Git 仓库、包含哪些顶层清单；
- 复现步骤与实际/预期行为；
- `npm run check` 和 `npm run pack:check` 输出（源码安装时）。

不要提交包含用户名、私有路径、仓库地址、Token、密钥或内部状态文本的未脱敏日志。
