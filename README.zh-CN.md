<div align="center">

# Rinco Pi

**面向 [Pi](https://pi.dev) 的模块化主题与工作流扩展集合。**

[![Pi collection](https://img.shields.io/badge/Pi-collection-F2A7C6?style=flat-square)](https://pi.dev) [![Packages](https://img.shields.io/badge/packages-4-9FD3F2?style=flat-square)](#项目列表) [![License](https://img.shields.io/badge/license-MIT-C7B8F5?style=flat-square)](LICENSE)

[项目列表](#项目列表) · [安装](#安装) · [迁移说明](#从-rinco-pi-settings-迁移)

[English](README.md) · 简体中文

</div>

Rinco Pi 是一组专注型 Pi 扩展的统一入口。外观、会话遥测、推理控制和项目规则分别维护在独立仓库中，可按需安装并单独升级。

> [!IMPORTANT]
> 本仓库仅作为项目导航，不是可安装的 Pi Package。请分别安装下方项目，不要再安装 `rinco-pi-settings`。

## 项目列表

| Package | 提供的能力 | 主要入口 |
| --- | --- | --- |
| [`rinco-pi-sakura`](https://github.com/Rinisnotarobot/rinco-pi-sakura) | Sakura Macaron 主题与动态 CyberDeck Header | 在 `/settings` 中选择 `sakura-macaron` |
| [`rinco-pi-hud`](https://github.com/Rinisnotarobot/rinco-pi-hud) | 实时显示项目、Git、Runtime、Session、模型用量与费用 | `/zentui`、`/codex-status`、`/usage-refresh` |
| [`rinco-pi-effort`](https://github.com/Rinisnotarobot/rinco-pi-effort) | 用于选择模型 Thinking Effort 的响应式 TUI | `/effort` |
| [`rinco-pi-rule`](https://github.com/Rinisnotarobot/rinco-pi-rule) | 检测项目技术栈，并安全、确定性地管理 `AGENTS.md` 中的 ECC 规则 | `/rules:init` |

每个项目都独立维护源码、版本、文档、测试和 Issue。

## 安装

可从 npm 按需安装任意组合：

```bash
pi install npm:rinco-pi-sakura
pi install npm:rinco-pi-hud
pi install npm:rinco-pi-effort
pi install npm:rinco-pi-rule
```

也可以直接从 GitHub 安装单个项目：

```bash
pi install git:github.com/Rinisnotarobot/rinco-pi-hud
```

安装后重启 Pi，或执行 `/reload`。使用 `pi list` 查看已安装项目，使用 `pi config` 启用或禁用其中的资源。

> [!WARNING]
> Pi 扩展以当前用户权限运行。安装第三方扩展前，请先审查其源码。

### 推荐组合

- **仅外观**：`rinco-pi-sakura`
- **会话仪表盘**：`rinco-pi-sakura` + `rinco-pi-hud`
- **推理控制**：增加 `rinco-pi-effort`
- **项目规范**：增加 `rinco-pi-rule`
- **完整工具集**：安装全部四个项目

## 从 `rinco-pi-settings` 迁移

原一体化项目 `rinco-pi-settings` / `pi-sakura-cyberdeck` 已停止使用，其运行时代码不再由本仓库维护。

| 原组件 | 新项目 |
| --- | --- |
| Sakura Macaron 主题与 CyberDeck Header | [`rinco-pi-sakura`](https://github.com/Rinisnotarobot/rinco-pi-sakura) |
| Zentui Footer、遥测、Git/Runtime 状态与用量指标 | [`rinco-pi-hud`](https://github.com/Rinisnotarobot/rinco-pi-hud) |
| Thinking Effort 选择器 | [`rinco-pi-effort`](https://github.com/Rinisnotarobot/rinco-pi-effort) |
| 项目技术栈规则 | [`rinco-pi-rule`](https://github.com/Rinisnotarobot/rinco-pi-rule) |

先移除旧 Git Package，再安装需要的替代项目：

```bash
pi remove git:github.com/Rinisnotarobot/rinco-pi-settings
pi install npm:rinco-pi-sakura
pi install npm:rinco-pi-hud
```

配置与使用说明现由各项目 README 分别维护。遇到具体问题时，请前往对应仓库提交 Issue。
