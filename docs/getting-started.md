# 快速开始

## 环境要求

- Pi `>= 0.80`；
- 支持 24-bit color（truecolor）的终端；
- 使用默认图标时建议安装 Nerd Font；没有 Nerd Font 时可切换到 `ascii` 图标模式；
- 若需要 Git 状态，系统 `PATH` 中应有 `git`；
- 若需要运行时版本，对应工具（如 `node`、`python`、`cargo`）应可执行；
- Codex subscription usage 优先使用 Pi Auth；可选安装并登录 Codex CLI 作为 fallback；
- 若需显示 Token Switch 余额，请在启动 Pi 前设置 `TOKEN_SWITCH_API_KEY`。

可以用以下命令粗略检查终端颜色能力：

```bash
printf '%s\n' "$COLORTERM"
```

通常输出 `truecolor` 或 `24bit` 表示支持。最终效果仍取决于终端和复用器配置。

## 安装

### 本地路径

在项目父目录或任意位置执行：

```bash
pi install ./pi-sakura-cyberdeck
```

这是开发和验收当前源码最直接的方式。

### npm

包发布后执行：

```bash
pi install npm:pi-sakura-cyberdeck
```

### Git 仓库

使用实际仓库所有者和仓库名替换占位信息：

```bash
pi install git:github.com/<owner>/pi-sakura-cyberdeck
```

> Pi 扩展以当前用户权限执行。安装第三方包前应审查源码。

## 启用主题

1. 启动 Pi TUI；
2. 打开 `/settings`；
3. 选择主题 **sakura-macaron**；
4. 重新进入或刷新会话，确认主题、Header 和 Footer 均正常显示。

Header 和 Footer 由包扩展自动注册；主题需要在 Pi 设置中选择。

## 首次配置 Footer

运行：

```text
/zentui
```

交互界面包含五个分区：

1. **Coloring**：Footer 使用 Pi 主题色还是终端样式；
2. **Features**：启用或停用状态行；
3. **Layout**：Context 样式、分隔符、路径、分支长度和图标模式；
4. **Built-in segments**：切换内置状态段；
5. **Extension segments**：设置当前活跃扩展状态的位置与颜色。

操作键：

- `Tab` / `Shift+Tab`：切换分区；
- `Enter` / `Space`：修改当前项；
- `Esc`：关闭。

无 Nerd Font 时，将 **Icon mode** 设为 `ascii`。

## 常用命令

```text
/zentui statusline enable
/zentui statusline disable
/zentui statusline toggle
/zentui format clear
/zentui format "$cwd on $git_branch $fill $context"
```

`format clear` 会清空自定义模板并恢复内置布局。命令还接受 `footer`、`status`、`on`、`off` 等同义表达，但推荐使用以上标准形式。

## 配置文件

用户覆盖存储在：

```text
~/.pi/agent/sakura-cyberdeck-zentui.json
```

- 文件不存在时使用运行时默认配置；
- 只有用户修改设置时才创建或更新文件；
- 删除该文件可恢复默认行为；
- 配置在当前进程中通过 `/zentui` 修改后立即应用；手工编辑文件通常需要重新进入会话才能重新加载；
- 如果 JSON 损坏，启动时会回退默认值，但保存设置时会拒绝覆盖损坏文件。

完整字段见[配置参考](configuration.md)。

## 升级与卸载

升级方式取决于安装来源。使用 Pi 对应的包管理命令重新安装或更新后，建议：

1. 新建会话；
2. 运行 `/zentui` 检查设置；
3. 运行项目仓库中的 `npm run check`（源码安装时）；
4. 若出现旧配置兼容问题，备份并删除 `~/.pi/agent/sakura-cyberdeck-zentui.json`。

卸载包后，可在 `/settings` 中切换到其他主题。若不再需要用户覆盖，可手工删除上述配置文件。

## 安装后验收

- 会话启动时能看到渐变 Header；
- `/settings` 中存在 `sakura-macaron`；
- Footer 能显示目录、OS、Context、Token 和费用；
- Git 仓库中能显示分支和工作区状态；
- `package.json`、`Cargo.toml` 等项目中可按需开启 Package version；
- `/zentui statusline toggle` 能即时切换 Footer；
- 使用 `openai-codex` Model 时 `/codex-status` 能显示订阅额度或明确的脱敏错误。

若不符合预期，参见[故障排查](troubleshooting.md)。
