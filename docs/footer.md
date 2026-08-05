# Footer 使用指南

## 内置状态段

| 配置键 | 默认 | 位置 | 说明 |
| --- | --- | --- | --- |
| `os` | 开 | 第一行 | 按平台显示 macOS、Linux 或 Windows 图标/文本 |
| `username` | 关 | 第一行 | `user@hostname` |
| `cwd` | 开 | 第一行 | 当前工作目录，可显示 basename 或完整路径 |
| `gitBranch` | 开 | 第一行 | 分支名；detached HEAD 时显示 `HEAD` |
| `gitStatus` | 开 | 第一行 | 冲突、暂存、修改、未跟踪、stash、ahead/behind 等 |
| `gitCounts` | 关 | 附属 | 为 ahead/behind 和 stash 显示数值，依赖 Git status |
| `gitCommit` | 关 | 第一行 | Commit 短哈希及可选精确匹配标签 |
| `gitMetrics` | 关 | 第一行 | `git diff HEAD --numstat` 汇总的新增/删除行数 |
| `packageVersion` | 关 | 第一行 | 项目清单声明的版本 |
| `runtime` | 开 | 第一行 | 检测到的语言/构建系统及本机工具版本 |
| `configCounts` | 关 | 第一行 | 指令文件、已安装 Pi packages 数量 |
| `sessionName` | 开 | 第二行 | 当前 Pi Session 名称 |
| `model` | 开 | 第二行 | Provider 与 Model ID |
| `thinking` | 开 | 第二行 | 支持 reasoning 时显示 Thinking level |
| `turnCount` | 开 | 第二行 | 当前 Turn index |
| `skills` | 开 | 第二行 | 当前 Session 已激活/可用 Skill 数量，例如 `★ 1/3` |
| `mcp` | 开 | 第二行 | MCP 已连接/总 Server 数 |
| `toolActivity` | 开 | 第二行 | Native Tool 完成次数或最近运行状态 |
| `agentActivity` | 开 | 第二行 | 当前主 Agent run 数，不等同于 Subagent 数 |
| `context` | 开 | 第三行 | Context 百分比、窗口大小和/或 Gauge |
| `tokens` | 开 | 第三行 | 输入、输出、Cache 等 Token 汇总 |
| `cacheDetails` | 开 | 第三行 | 累计 Cache read/write Token |
| `cost` | 开 | 第三行 | Session entries 中累计费用 |
| `codexUsage` | 开 | 第三行 | Codex 订阅 5h/weekly 剩余额度 |
| `sessionDuration` | 关 | 第三行 | 当前会话持续时间 |
| `time` | 关 | 第三行 | 当前时间 `HH:MM` |

空 `footerFormat` 使用分类左对齐三行布局：`⌂ 项目`、`λ 会话`、`◉ 用量`。MCP 位于第二行；设置非空 `footerFormat` 后继续使用兼容的单行模板布局，模板变量决定内置内容。其他扩展状态按 placement 的 left、middle、right 顺序追加到第二行。

## Git 状态

Footer 可显示：

- 分支、detached HEAD、Commit OID 和精确匹配 Tag；
- ahead、behind、diverged；
- conflicted、untracked、stashed、modified、staged、renamed、deleted、typechanged；
- rebase、merge、cherry-pick、revert、bisect 等 Git 操作状态；
- 相对 `HEAD` 的新增/删除行数。

基础探测使用：

```text
git status --porcelain=2 --branch
git stash list
```

仅在相关状态段或模板变量被使用时，才额外探测 Tag、Commit metrics 和项目版本。Git 命令超时为 2 秒。

## Runtime 与 Package version 的区别

- **Runtime**：本机工具链版本，例如 `node v22.14.0`；会执行版本命令。
- **Package version**：项目清单中声明的版本，例如 `package.json` 的 `version`；只读文件，不执行清单脚本。

两者都只检查当前工作目录顶层，不向父目录递归。

### Runtime 支持范围

当前检测包括：Xmake、Maven、Gradle、Bun、Deno、Lua、Node.js、Python、Go、Rust、Java、Ruby、PHP、Buf、CMake、C++、C、COBOL、Conda、Crystal、Dart、.NET、Elixir、Elm、Erlang、Fennel、Fortran、Gleam、Guix Shell、Haskell、Haxe、Helm、Julia、Kotlin、Meson、Mojo、Nim、Nix Shell、OCaml、Odin、OPA、Perl、Pixi、Pulumi、PureScript、Raku、Red、R、Scala、Solidity、Spack、Swift、Terraform、Typst、Vagrant、V、Zig。

检测依据可能是顶层文件、目录、扩展名、环境变量或排除文件。多个 Runtime 同时匹配时，构建系统优先，其次是常用 Runtime，再按定义顺序选择。

### 项目版本清单

| 生态 | 清单 |
| --- | --- |
| Node.js / Bun | `package.json` |
| Deno | `deno.json`, `deno.jsonc` |
| Maven | `pom.xml` |
| Gradle | `gradle.properties` |
| Python | `pyproject.toml`, `setup.cfg` |
| Rust | `Cargo.toml` |
| PHP | `composer.json` |
| Crystal | `shard.yml` |
| Dart | `pubspec.yaml`, `pubspec.yml` |
| Elixir | `mix.exs` |
| Elm | `elm.json` |
| Fortran | `fpm.toml` |
| Gleam | `gleam.toml` |
| Haskell | `*.cabal` |
| Helm | `Chart.yaml` |
| Julia | `Project.toml` |
| Meson | `meson.build` |
| Nim | `*.nimble` |
| Ruby | `*.gemspec` |
| V | `v.mod` |
| Xmake | `xmake.lua` |

解析器只支持静态、常见的版本声明形式。动态计算版本或不受支持的语法会静默跳过。

## Context、Token 与费用

### Context

`contextStyle` 支持：

- `text`：如 `35%/200k`；
- `gauge`：进度条；
- `text+gauge`：文字与进度条组合。

默认阈值：

- `< 70%`：正常；
- `>= 70%`：警告；
- `>= 90%`：错误。

流式 Assistant 消息更新期间，Footer 使用消息 usage 估算实时 Context；更新合并为约 250ms 一次，避免每个增量都重绘。

### Token 与费用

Token 和费用从当前 Session 的 Assistant entries 累计，包括 input、output、cacheRead、cacheWrite 和 `cost.total`。数值会格式化为原数、`k` 或 `M`，费用保留三位小数。`cacheDetails` 额外显示累计 `R`/`W`，`$cache_hit` 表示最新 Assistant message 的 Cache hit rate。

## 整合状态

### Session、Model 与活动

- Session 名称来自 `sessionManager.getSessionName()`，并响应 `session_info_changed`；
- Turn 来自 `turn_start.turnIndex`；
- Model 显示 `provider/model-id`；仅 reasoning-capable Model 显示 Thinking level；
- Tool 使用 `toolCallId` 精确关联开始与结束，避免并发同名 Tool 错配；
- Tool 完成计数覆盖 `read`、`write`、`edit`、`bash`、`grep`、`ls`、`find`；
- Running Tool 最多展示最近两个，并显示经过清洗、截断的 target 和 elapsed；
- Agent activity 表示 Pi 主 Agent loop 是否正在运行，不代表 Subagent 数量。Subagent 仍由对应扩展状态提供。

### MCP

MCP 状态从其他扩展发布的 `mcp` Footer status 中非侵入式解析，支持 `MCP: connected/total servers`。解析成功且专用 MCP 状态段可见时，不重复显示原始 status；解析失败则保留原始扩展状态。

### Skill 与配置统计

- Skill 总数来自 Pi 当前实际发现的 Skill 资源，覆盖全局、项目、Package、Settings、CLI 与扩展动态资源；
- 同一 Session 中通过 `/skill:name` 展开，或由 Agent 成功读取对应 Skill 文件后，该 Skill 计为已激活；
- 激活状态按当前 Session branch 恢复，重复读取同一 Skill 只计一次；
- 当前 cwd 顶层 `AGENTS.md` 与 `CLAUDE.md` 分开统计；
- Extensions 数来自 Pi Agent 目录 `settings.json#packages`；
- 文件统计随项目刷新更新，不在 Footer render 中读文件。

### 模型额度

状态栏根据当前 Model Provider 自动切换额度信息：

- `openai-codex`：优先使用 Pi Model Registry 提供的 Codex Auth 请求 ChatGPT usage endpoint，失败时回退到 `codex app-server --listen stdio://`；状态仅显示周限制剩余百分比，例如 `codex 75% wk`。
- `token-switch`：使用环境变量 `TOKEN_SWITCH_API_KEY` 分别请求 billing subscription 与 usage 接口，按 `hard_limit_usd - total_usage / 100` 计算并显示可用额度，例如 `token-switch $750.00`。
- 两种查询均使用 15 秒超时、5 分钟缓存和自动刷新周期；每次通过 `/model` 选择模型都会强制刷新，切换到其他 Provider 时清除额度状态。
- `/usage-refresh` 按当前 Provider 刷新状态栏：`token-switch` 下只重新查询余额，其他情况等价于 `/codex-status --refresh`。
- `/codex-status` 仍用于显示 Codex 详细报告，`--refresh` 强制刷新，`--timeout 1..120` 调整本次查询超时。在 `token-switch` Model 下执行时只弹出报告，**不会**覆盖状态栏里的余额。

```text
/codex-status
/codex-status --refresh
/codex-status --no-statusline
/codex-status --clear-statusline
/codex-status --timeout 30
/usage-refresh
```

## 自定义模板

### 设置与清除

```text
/zentui format "$os  $cwd(  $git_branch)$fill($context)(  $tokens)(  $cost)"
/zentui format clear
```

也可以在配置文件中设置 `footerFormat`。

### 语法

- `$name` 和 `${name}`：变量；
- `( ... )`：条件组；包含内容变量时，所有内容变量均为空才隐藏；纯文本组始终显示；
- `$fill`：顶层布局分区标记；
- 普通文字和空格原样输出；
- 未知变量渲染为空字符串。

条件组可嵌套。`$sep` 仅作为分隔符，不会独自使条件组显示，因此 `($sep$tokens)` 在 `$tokens` 为空时会整体消失。

### `$fill` 规则

| 数量 | 布局 |
| --- | --- |
| 0 | 全部位于左侧 |
| 1 | 左 / 右 |
| 2 | 左 / 中 / 右 |
| > 2 | 只使用前两个 |

条件组内部的 `$fill` 不参与分区，并渲染为空。

### 变量

| 变量 | 内容 |
| --- | --- |
| `$cwd` | 当前目录 |
| `$git_branch` | Git 图标与分支 |
| `$git_status` | Git 文件状态及 ahead/behind |
| `$git_state` | rebase、merge 等操作状态 |
| `$runtime` | Runtime 图标与工具版本 |
| `$session_duration` | 会话时长 |
| `$username` | `user@hostname` |
| `$os` | OS 图标/文本 |
| `$time` | 当前时间 |
| `$context` | Context 状态 |
| `$tokens` | Token 汇总 |
| `$cost` | Session 费用 |
| `$package` | Package 图标与项目版本 |
| `$package_version` | 仅项目版本文本 |
| `$git_commit` | Commit 短哈希和可选 Tag |
| `$git_tag` | 仅精确匹配 Tag |
| `$git_metrics` | 新增/删除行数 |
| `$git_added` | 仅新增行数 |
| `$git_deleted` | 仅删除行数 |
| `$session_name` | Session 名称 |
| `$model` | Provider/Model |
| `$provider` | 仅 Provider ID |
| `$model_id` | 仅 Model ID |
| `$thinking` | Thinking level |
| `$turn` | Turn index |
| `$cache_read` | 累计 Cache read Token |
| `$cache_write` | 累计 Cache write Token |
| `$cache_hit` | 最新 Cache hit rate |
| `$codex_usage` | Codex 订阅摘要 |
| `$instruction_files` | `AGENTS.md` + `CLAUDE.md` 总数 |
| `$agents_files` | `AGENTS.md` 数量 |
| `$claude_files` | `CLAUDE.md` 数量 |
| `$skills` | 已激活/可用 Skill 数量，例如 `★ 1/3` |
| `$active_skills` | 仅已激活 Skill 数量 |
| `$extensions` | 已安装 Pi packages 数量 |
| `$mcp` | MCP connected/total |
| `$tool_counts` | Native Tool 完成次数 |
| `$running_tools` | 最近运行中的 Tool |
| `$active_agents` | 活跃主 Agent run 数 |
| `$sep` | 固定样式的 ` | ` |
| `$fill` | 布局标记，不输出文字 |

别名：

```text
$directory → $cwd
$branch → $git_branch
$status → $git_status
$state → $git_state
$commit → $git_commit
$tag → $git_tag
$duration → $session_duration
$session → $session_name
$thinking_level → $thinking
$turn_count → $turn
$codex → $codex_usage
$tools → $tool_counts
$agents → $active_agents
$separator → $sep
```

### 示例

简洁左右布局：

```text
$cwd( on $git_branch)($git_status)$fill($context)( | $cost)
```

三栏布局：

```text
$os $cwd$fill($git_state)$fill$context $tokens
```

开发信息布局：

```text
$cwd( $git_branch)( $git_commit)( $git_metrics)( $package)( $runtime)$fill$context
```

## 其他扩展状态

Footer 会读取 Pi 的 `footerData.getExtensionStatuses()`：

- placement：`off`、`left`、`middle`、`right`；空模板时决定第二行的追加顺序，非空模板时决定实际对齐区域；
- color mode：`zentui` 或 `original`；
- 同一位置按状态 key 排序；
- `zentui` 使用统一的 `extensionStatus` 颜色；
- `original` 只保留安全的 SGR 样式序列；
- 换行、控制字符和危险终端控制序列会被清理。

`/zentui` 的 **Extension segments** 只列出当前活跃状态。未命中预设或用户覆盖的 key 默认 placement 为 `right`；源码预设中 `dual-subscription-quota` 位于 `left`、`codex-goal` 位于 `middle`、`xai-usage` 位于 `right`。

## 三行布局与窄终端行为

空 `footerFormat` 时 Footer 输出三行：

```text
⌂ 项目 · pi-sakura ·  main ·  24.18
λ 会话 · gpt-5.3 · high · ↺ 8 · ★ 2/3 · ⊕ 2/2
◉ 用量 · 35%/200k · ↑ 4.2k · ↓ 1.1k · $ 0.030
```

计数类状态会在符号和数字之间保留间隙，例如 `↺ 3`、`↑ 4.2k`、`read × 2`、`⇡ 1`，避免连续 glyph 和数字挤在一起。

每一行都独立计算可见宽度：

1. 三行分别使用固定分类标识，所有状态从左向右排列，不做左右拉伸；
2. 第一行聚合项目与环境，第二行聚合会话、执行活动与 MCP，第三行聚合用量与服务；
3. 其他扩展状态按 placement 的 left、middle、right 顺序追加到第二行；
4. 空间不足时在当前行末尾安全截断并显示省略号；
5. 每行最终按终端可见宽度再次截断。

非空 `footerFormat` 保持原有单行行为。若窄终端信息过多，建议关闭低优先级状态段或使用更短的模板。
