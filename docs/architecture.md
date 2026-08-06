# 架构说明

## 包加载

根目录 `package.json` 的 `pi` 字段注册：

```json
{
  "extensions": [
    "./extensions/header/index.ts",
    "./extensions/zentui/index.ts"
  ],
  "themes": [
    "./themes/sakura-macaron.json"
  ]
}
```

Pi 直接加载 TypeScript 扩展源码和 JSON 主题。项目没有编译步骤、输出目录或独立启动命令。

## 模块图

```text
package.json
├── extensions/header/index.ts
├── extensions/zentui/index.ts          生命周期与副作用编排
│   ├── config.ts                       配置模型、归一化与持久化
│   ├── footer.ts                       Footer 状态段渲染
│   │   ├── footer-layout.ts            分类左对齐布局与宽度预算
│   │   ├── footer-format.ts            模板解析
│   │   ├── extension-status.ts         外部状态清洗与分组
│   │   ├── format.ts                   文本/数值格式化
│   │   ├── icons.ts                    图标模式与解析
│   │   └── style.ts                    主题与终端样式
│   ├── state.ts                        聚合状态
│   ├── git.ts                          Git 探测
│   ├── runtime.ts                      Runtime 探测与缓存
│   ├── package-version.ts              项目清单版本解析
│   ├── telemetry.ts                    Session/Turn/Tool/Agent 活动
│   ├── skill-activity.ts               Skill 发现与 Session 激活状态
│   ├── config-counts.ts                指令与 Package 统计
│   ├── mcp-status.ts                   非侵入式 MCP 状态解析
│   ├── codex-usage/                    Codex Auth、CLI fallback 与格式化
│   ├── project-state.ts                刷新结果应用与 last-good
│   ├── project-refresh.ts              节流、合并与周期刷新
│   ├── live-context.ts                 流式 Context 覆盖
│   ├── session-lifecycle.ts            Session generation 防护
│   └── settings-command.ts             /zentui 命令和 TUI
└── themes/sakura-macaron.json
```

## Header 生命周期

```text
session_start
  └── ctx.ui.setHeader(component)
        └── render(width)
              ├── 获取终端可用行数
              ├── 裁剪 Unicode 图案
              ├── 计算水平/垂直留白
              └── 应用 Sakura → Sky RGB 渐变

session_shutdown
  └── ctx.ui.setHeader(undefined)
```

无 UI 时不会安装 Header。

## Footer 生命周期

### 会话启动

`extensions/zentui/index.ts` 在 `session_start`：

1. 启动新的 `SessionLifecycle` generation；
2. 清理流式 Context；
3. 从 Pi Skill 资源与当前 Session branch 恢复 Skill 总数/激活数；
4. 记录 Session 起始时间；
5. 使 Token/费用缓存失效；
6. 清除上一个项目 cwd；
7. 读取配置并同步初始模型/Usage 状态；
8. TUI 且 `features.statusLine=true` 时安装 Footer；
9. 启动周期刷新并强制首次项目刷新；
10. 按需启动时间/会话时长计时器。

### 事件处理

| Pi 事件 | 主要动作 |
| --- | --- |
| `resources_discover` | 资源扩展完成后同步可用 Skill 总数 |
| `before_agent_start` | 同步 Skill 列表并识别 `/skill:name` 展开的激活 Skill |
| `agent_start` | 清理 live Context，同步交互状态 |
| `agent_end` | 清理 live Context，同步并刷新项目 |
| `model_select` | 清理 live Context，同步模型状态 |
| `thinking_level_select` | 更新 Thinking level 并重绘 |
| `session_info_changed` | 更新 Session 名称 |
| `turn_start` | 更新 Turn index |
| `message_update` | 更新流式 Context，约 250ms 合并重绘 |
| `message_end` | 刷新 Usage 缓存并刷新项目；错误/中止时清 live Context |
| `tool_execution_start` | 清 live Context，以 toolCallId 记录 Running Tool |
| `tool_execution_end` | 完成对应 Tool；成功读取 Skill 文件时计为激活；同步并刷新项目 |
| `session_compact` | 清 live Context、Usage 缓存并刷新项目 |
| `session_tree` | 清 live Context，按新 branch 恢复 Skill 激活状态、Usage 缓存并刷新项目 |
| `session_shutdown` | 停止定时器、刷新器和 Footer |

Git 分支变化还会由 `footerData.onBranchChange()` 触发刷新。

Thinking level 选择功能不属于本包；`/effort` 已迁移至独立的 [`rinco-pi-effort`](https://github.com/Rinisnotarobot/rinco-pi-effort) 扩展。本包只监听 Pi 的 `thinking_level_select` 事件并更新 Footer。

## 状态模型

`FooterState` 聚合：

- 模型与 Provider；
- Token、费用和 Cache label；
- Git branch/status/state/commit/metrics；
- Runtime；
- Package version；
- Session 名称、Turn、Thinking level；
- Tool 历史和主 Agent run 活动；
- Skill 总数与当前 Session branch 的激活数；
- 配置统计与 Codex usage 状态；
- Session 起始时间。

渲染器不在每帧执行文件读写或子进程。副作用发生在事件刷新路径，结果写入共享状态，Footer `render()` 只读取最新快照和 Pi 提供的数据。

## 项目刷新

```text
scheduleProjectRefresh(ctx)
  └── scheduler.schedule({ cwd, generation })
        ├── 5 秒节流
        ├── 同时仅一个 refresh in flight
        └── 合并 pending target
              └── Promise.all
                    ├── readGitStatus(cwd)
                    ├── readRuntimeInfo(cwd)
                    ├── readPackageVersionResult(cwd) [按需]
                    └── countConfigEntries(cwd)
                          └── applyProjectRefreshToState()
                                └── requestRender()
```

### 按需探测

为了减少成本，仅在对应内置段开启或模板引用变量时探测：

- 精确 Tag：`gitCommit` + `showTag`，或 `$git_tag`；
- Git metrics：`gitMetrics`、`$git_metrics`、`$git_added`、`$git_deleted`；
- Package version：`packageVersion`、`$package`、`$package_version`。

### 并发与过期结果

- `SessionLifecycle` 为每个会话维护 generation；
- 异步结果写入前检查 generation；
- Shutdown 会令当前 generation 失效；
- 调度器 stop 时清除延迟任务和 pending 状态；
- 定时器使用 `unref()`，不会单独阻止 Node 退出。

## Last-good 错误策略

同一 cwd 的瞬时错误不会立刻清掉所有可见信息：

| 数据源结果 | 同一 cwd | cwd 已变化 |
| --- | --- | --- |
| Git `ok` | 更新 | 更新 |
| Git `not_a_repo` | 清空 | 清空 |
| Git `error` | 保留上次成功值 | 清空旧项目值 |
| Runtime `ok` | 更新 | 更新 |
| Runtime `error` | 保留上次成功值 | 清空旧项目值 |
| Package `ok(value)` | 更新 | 更新 |
| Package `ok(null)` | 清空 | 清空 |
| Package `error` | 保留上次成功值 | 清空旧项目值 |

这避免短暂命令超时导致 Footer 闪烁，同时防止切换项目后显示旧项目状态。

## Runtime 缓存

Runtime 检测根据 cwd 和顶层目录 fingerprint 缓存，最多保留 32 条。版本命令超时为 2.5 秒；若检测到项目类型但命令不存在或失败，仍显示 Runtime 图标/名称，不显示版本。

## Footer 渲染管线

1. 读取当前配置；
2. 解析路径、Git、Context、Token、费用等状态段，并规范化计数符号与数字间距；
3. 空模板按 `⌂ 项目`、`λ 会话`、`◉ 用量` 分类为三行并全部左对齐；非空 `footerFormat` 解析兼容的单行模板；
4. 读取其他扩展状态；
5. 清洗状态文本并按 left/middle/right 分组顺序追加到第二行，MCP 专用段也位于第二行；
6. 为每一行独立分配可见宽度预算；
7. 空模板在行末安全截断并输出三行，非空模板截断并输出单行。

宽度由 `@earendil-works/pi-tui` 的 `visibleWidth()` 和 `truncateToWidth()` 计算，可正确忽略 ANSI 样式序列。Header 的图案宽度则按 Unicode code point 估算，对部分全角、组合字符或特殊 glyph 可能不完全准确。

## 模型额度数据流

额度 controller 在 `openai-codex` 和 `token-switch` Model 下自动运行：

```text
session_start / session_tree / model_select
  └── cache (5 min)
      ├── openai-codex
      │   ├── Pi modelRegistry auth → HTTPS chatgpt.com/backend-api/wham/usage
      │   └── fallback: codex app-server over stdio JSON-RPC
      │       └── normalize report → 周限制剩余百分比
      └── token-switch
          └── TOKEN_SWITCH_API_KEY → HTTPS Neolink billing subscription + usage
              └── hard_limit_usd - total_usage / 100 → 可用额度
```

认证 Header 只存在于查询局部变量，不写入 Footer state；外部响应有大小限制，密钥不会写入错误或状态文本。Codex 错误 body 会脱敏和截断；CLI 使用固定 executable/arguments 且不经过 Shell，结束后关闭 stdin 并终止 child。详细 Codex 报告通过 `/codex-status` 通知显示。

## 配置安全边界

配置持久化采取：

- 类型白名单和范围归一化；
- 损坏文件拒绝覆盖；
- 同目录临时文件；
- `fsync` 后原子 rename；
- 保留权限与符号链接目标；
- 未知字段尽量保留。

其他扩展状态采取：

- 去除换行和 C0/C1 控制字符；
- 去除 VT 控制序列；
- `original` 模式只恢复安全 SGR 颜色序列；
- 空状态不渲染。

## 外部副作用

运行时可能：

- 执行 `git` 命令；
- 执行检测到的语言、构建工具或 Runtime 的版本命令；
- 在 Codex Model 下请求固定 ChatGPT usage endpoint，必要时启动 `codex app-server`；
- 读取当前 cwd 的顶层目录、项目清单和指令文件；
- 读取 Pi 当前发现的 Skill 元数据和 Session branch；
- 读取 Pi Agent directory 的 `settings.json#packages`；
- 写入用户 Agent 目录下的 Zentui 配置。

它不会执行项目清单中的脚本，也不会递归扫描整个仓库或父目录。
