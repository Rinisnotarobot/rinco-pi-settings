# 配置参考

## 文件位置与加载

```text
~/.pi/agent/sakura-cyberdeck-zentui.json
```

路径由 Pi 的 Agent 目录解析，不一定硬编码为用户 Home。行为如下：

- 文件不存在：不主动创建，使用 `mergeConfig({})` 的运行时默认值；
- 文件有效：只采用受支持且类型正确的字段；
- 未知字段：运行时忽略，但通过设置界面保存时尽量保留；
- 文件损坏或不可读：加载时静默回退默认值，保存时拒绝覆盖；
- 写入：使用同目录临时文件、`fsync` 和原子 rename；
- 符号链接：写入解析后的目标；
- 已有文件：保留权限模式。

## 完整示例

以下示例展示所有主要字段；它不是必须创建的默认文件：

```json
{
  "projectRefreshIntervalMs": 30000,
  "footerFormat": "",
  "separator": "chevron",
  "contextStyle": "text+gauge",
  "contextThresholds": {
    "warning": 70,
    "error": 90
  },
  "pathDisplay": {
    "mode": "basename",
    "depth": 0
  },
  "gitBranch": {
    "maxLength": 30
  },
  "icons": {
    "mode": "auto"
  },
  "colors": {
    "cwd": "bold #F2A7C6",
    "gitBranch": "bold #C7B8F5",
    "gitStatus": "bold #F6BC9A",
    "contextNormal": "#AEE5C5",
    "contextWarning": "bold #F3D98B",
    "contextError": "bold #FF8FA3",
    "tokens": "#A99BAE",
    "cost": "bold #AEE5C5",
    "separator": "#716879",
    "runtimePrefix": "#9FD3F2",
    "extensionStatus": "#EFC3E6",
    "sessionDuration": "#F3D98B",
    "packageVersion": "#F6BC9A",
    "gitCommit": "#AEE5C5",
    "gitMetricsAdded": "#AEE5C5",
    "gitMetricsDeleted": "#FF8FA3",
    "username": "#F3D98B",
    "time": "#F3D98B",
    "os": "#F7EEF8"
  },
  "colorSources": {
    "starship": "terminal"
  },
  "features": {
    "statusLine": true
  },
  "footerSegments": {
    "cwd": true,
    "gitBranch": true,
    "gitStatus": true,
    "gitCounts": false,
    "gitCommit": false,
    "gitMetrics": false,
    "sessionName": true,
    "model": true,
    "thinking": true,
    "turnCount": true,
    "cacheDetails": true,
    "codexUsage": true,
    "configCounts": false,
    "skills": true,
    "mcp": true,
    "toolActivity": true,
    "agentActivity": true,
    "runtime": true,
    "context": true,
    "tokens": true,
    "cost": true,
    "sessionDuration": false,
    "username": false,
    "time": false,
    "os": true,
    "packageVersion": false
  },
  "gitCommit": {
    "hashLength": 7,
    "onlyDetached": true,
    "showTag": true
  },
  "gitMetrics": {
    "onlyNonzero": true,
    "ignoreSubmodules": false
  },
  "extensionStatuses": {
    "defaultPlacement": "right",
    "placements": {
      "dual-subscription-quota": "left",
      "codex-goal": "middle",
      "xai-usage": "right"
    },
    "colorModes": {}
  }
}
```

## 顶层字段

| 字段 | 类型 / 取值 | 无文件时行为 | 说明 |
| --- | --- | --- | --- |
| `projectRefreshIntervalMs` | number | `30000` | 项目状态周期刷新；`0` 关闭；正数最小 5000ms |
| `footerFormat` | string | `""` | 空字符串使用内置布局；非空使用模板 |
| `separator` | `pipe\|dot\|chevron\|none` | `chevron` | 内置状态段分隔符 |
| `contextStyle` | `text\|gauge\|text+gauge` | `text+gauge` | Context 展示形式 |
| `contextThresholds` | object | `70/90` | Context 颜色阈值 |
| `pathDisplay` | object | basename | 路径显示方式 |
| `gitBranch` | object | 30 | 分支最大可见宽度 |
| `icons` | object | `auto` | 图标模式和覆盖 |
| `colors` | object | 见示例 | 各状态段样式 |
| `colorSources` | object | terminal | 颜色解释方式 |
| `features` | object | statusLine 开 | UI 功能开关 |
| `footerSegments` | object | 见示例 | 内置状态段开关 |
| `gitCommit` | object | 见示例 | Commit 选项 |
| `gitMetrics` | object | 见示例 | 行数统计选项 |
| `extensionStatuses` | object | right | 其他扩展状态设置 |

## 整合状态段默认值

```json
{
  "footerSegments": {
    "sessionName": true,
    "model": true,
    "thinking": true,
    "turnCount": true,
    "cacheDetails": true,
    "codexUsage": true,
    "configCounts": false,
    "skills": true,
    "mcp": true,
    "toolActivity": true,
    "agentActivity": true
  }
}
```

所有状态沿用 Sakura Zentui 的颜色配置，不引入独立 Shannon/Monokai 配色。空 `footerFormat` 使用 `⌂ 项目`、`λ 会话`、`◉ 用量` 分类左对齐三行 Footer，MCP 位于第二行；`configCounts` 默认关闭以控制首行宽度，`skills` 默认开启并显示当前 Session 的已激活/可用 Skill 数量，其余状态在有值时显示。计数类符号与数字之间保留空格。非空 `footerFormat` 保持单行模板行为，也可以只引用所需变量。

> `defaultConfig` 与缺少配置文件时的 `mergeConfig({})` 保持一致：30000ms、空模板和 `auto` 图标模式。

## 刷新间隔

```json
{ "projectRefreshIntervalMs": 30000 }
```

- `0`：关闭周期刷新；事件触发的刷新仍可能发生；
- 非法或缺失：30000ms；
- 小于等于 0（除明确的 0 外）：归一化为关闭；
- 1～4999：提升到 5000ms；
- 刷新调度自身还有 5000ms 节流，并合并并发请求。

## 路径与分支

```json
{
  "pathDisplay": { "mode": "full", "depth": 3 },
  "gitBranch": { "maxLength": "full" }
}
```

- `pathDisplay.mode`：`basename` 或 `full`；
- `depth`：0～5；0 表示完整路径，正数只保留末尾若干目录；仅 `full` 模式生效；
- Home 目录会收缩为 `~`；
- `gitBranch.maxLength`：正整数或 `"full"`。

## Context 阈值

```json
{
  "contextThresholds": { "warning": 70, "error": 90 }
}
```

值会四舍五入并限制在 0～100。若 `error < warning`，加载时自动交换两者。

## 图标

```json
{
  "icons": {
    "mode": "ascii",
    "git": "git:",
    "package": "pkg"
  }
}
```

模式：

- `auto`：当前与 `nerd` 一样使用 Nerd Font 默认 glyph；
- `nerd`：强制 Nerd Font 默认 glyph；
- `ascii`：使用纯文本回退。

可覆盖键：

```text
cwd, git, ahead, behind, diverged, conflicted, untracked,
stashed, modified, staged, renamed, deleted, typechanged,
cacheHit, username, time, os, package
```

字符串覆盖优先于模式默认值。OS 在未自定义时按 `darwin`、`linux`、`win32` 解析；Runtime 在 ASCII 模式中使用短名称。

## 颜色与样式

### 颜色来源

```json
{ "colorSources": { "starship": "terminal" } }
```

- `terminal`：按 ANSI/Starship 风格解释；
- `theme`：优先映射到 Pi theme token；显式 Hex、色号或 `fg:`/`bg:` 仍按终端颜色处理。

### 支持格式

```text
bold #F2A7C6
underline bg:#14111A fg:#F7EEF8
bright-cyan
202
fg:202
bg:blue
dim italic accent
```

支持：

- 修饰符：`bold`、`dim`/`dimmed`、`italic`、`underline`；
- ANSI 命名色及 bright 变体；
- 0～255 色号；
- `#RGB`、`#RRGGBB`；
- `fg:`、`bg:`；
- Pi theme token，如 `accent`、`warning`、`syntaxKeyword`。

配置中的非法样式会被忽略并回退到该字段默认值。主题无法解析的值在渲染时降级为无样式文本，不中断 Footer。

### 颜色键

```text
cwd, gitBranch, gitStatus, contextNormal, contextWarning,
contextError, tokens, cost, separator, runtimePrefix,
extensionStatus, sessionDuration, packageVersion, gitCommit,
gitMetricsAdded, gitMetricsDeleted, username, time, os
```

兼容旧键：`cwdText → cwd`、`git → gitBranch`。未知和已废弃键不会参与渲染。

## Commit 与 Metrics

```json
{
  "gitCommit": {
    "hashLength": 7,
    "onlyDetached": true,
    "showTag": true
  },
  "gitMetrics": {
    "onlyNonzero": true,
    "ignoreSubmodules": false
  }
}
```

- `hashLength`：限制在 4～40；
- `onlyDetached`：提交段只在 detached HEAD 显示；
- `showTag`：显示精确匹配 `HEAD` 的 Tag；
- `onlyNonzero`：隐藏零值 metrics；
- `ignoreSubmodules`：计算 metrics 时忽略 Submodule。

## 其他扩展状态

```json
{
  "extensionStatuses": {
    "defaultPlacement": "right",
    "placements": {
      "example-status": "middle"
    },
    "colorModes": {
      "example-status": "original"
    }
  }
}
```

- placement：`off`、`left`、`middle`、`right`；空模板时决定第二行的追加顺序，非空模板时仍决定实际对齐区域；
- color mode：`zentui`、`original`；
- 未命中 `placements` 的 key 使用 `defaultPlacement`，未命中 `colorModes` 的 key 使用 `zentui`；
- 运行时默认预设为 `dual-subscription-quota → left`、`codex-goal → middle`、`xai-usage → right`；
- 建议通过 `/zentui` 设置活跃状态，避免手工拼错 key。

## Codex 与外部状态说明

Codex 订阅查询目前使用固定行为而不是独立配置对象：仅 `openai-codex` Model 自动查询，15 秒超时、5 分钟缓存/刷新，Pi Auth 失败后允许 Codex CLI fallback。可用 `footerSegments.codexUsage` 控制内置显示，或使用 `$codex_usage` 模板变量；`/codex-status --no-statusline` 只显示报告。

MCP 专用段只解析其他扩展发布的公开 Footer status，不替换 `ctx.ui.setStatus()`。Skill 总数来自 Pi 当前发现的资源，激活数来自当前 Session branch 中展开或成功读取的 Skill；其他配置统计使用 Pi 的 Agent directory，并容错处理缺失或损坏的 settings。

## 手工恢复

先备份：

```bash
cp ~/.pi/agent/sakura-cyberdeck-zentui.json \
  ~/.pi/agent/sakura-cyberdeck-zentui.json.bak
```

恢复全部默认值：

```bash
rm ~/.pi/agent/sakura-cyberdeck-zentui.json
```

若文件损坏且 `/zentui` 提示拒绝保存，修复为合法 JSON object，或备份后删除。顶层必须是对象，不能是数组、字符串或 `null`。
