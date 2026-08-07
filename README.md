<div align="center">

# Rinco Pi

**A modular collection of themes and workflow extensions for [Pi](https://pi.dev).**

[![Pi collection](https://img.shields.io/badge/Pi-collection-F2A7C6?style=flat-square)](https://pi.dev) [![Packages](https://img.shields.io/badge/packages-4-9FD3F2?style=flat-square)](#projects) [![License](https://img.shields.io/badge/license-MIT-C7B8F5?style=flat-square)](LICENSE)

[Projects](#projects) · [Installation](#installation) · [Migration](#migration-from-rinco-pi-settings)

English · [简体中文](README.zh-CN.md)

</div>

Rinco Pi is the entry point for a set of focused Pi packages. Appearance, session telemetry, reasoning controls, and project rules live in separate repositories, so you can install only the features you need and update them independently.

> [!IMPORTANT]
> This repository is a project directory, not an installable Pi package. Install the packages below individually; do not install `rinco-pi-settings`.

## Projects

| Package | What it adds | Main entry points |
| --- | --- | --- |
| [`rinco-pi-sakura`](https://github.com/Rinisnotarobot/rinco-pi-sakura) | Sakura Macaron theme and animated CyberDeck header | `sakura-macaron` in `/settings` |
| [`rinco-pi-hud`](https://github.com/Rinisnotarobot/rinco-pi-hud) | Real-time project, Git, runtime, session, model usage, and cost footer | `/zentui`, `/codex-status`, `/usage-refresh` |
| [`rinco-pi-effort`](https://github.com/Rinisnotarobot/rinco-pi-effort) | Responsive TUI selector for model thinking effort | `/effort` |
| [`rinco-pi-rule`](https://github.com/Rinisnotarobot/rinco-pi-rule) | Stack detection and safe, deterministic ECC rule management for `AGENTS.md` | `/rules:init` |

Each project has its own source, releases, documentation, tests, and issue tracker.

## Installation

Install any combination from npm:

```bash
pi install npm:rinco-pi-sakura
pi install npm:rinco-pi-hud
pi install npm:rinco-pi-effort
pi install npm:rinco-pi-rule
```

Alternatively, install a package directly from GitHub:

```bash
pi install git:github.com/Rinisnotarobot/rinco-pi-hud
```

Restart Pi after installation, or run `/reload`. Use `pi list` to inspect installed packages and `pi config` to enable or disable their resources.

> [!WARNING]
> Pi extensions run with your user permissions. Review third-party source code before installing it.

### Choose a setup

- **Appearance only** — `rinco-pi-sakura`
- **Session dashboard** — `rinco-pi-sakura` + `rinco-pi-hud`
- **Reasoning controls** — add `rinco-pi-effort`
- **Project guidance** — add `rinco-pi-rule`
- **Complete toolkit** — install all four packages

## Migration from `rinco-pi-settings`

The former all-in-one `rinco-pi-settings` / `pi-sakura-cyberdeck` package has been retired. Its runtime code is no longer maintained in this repository.

| Previous component | New home |
| --- | --- |
| Sakura Macaron theme and CyberDeck header | [`rinco-pi-sakura`](https://github.com/Rinisnotarobot/rinco-pi-sakura) |
| Zentui footer, telemetry, Git/runtime state, and usage indicators | [`rinco-pi-hud`](https://github.com/Rinisnotarobot/rinco-pi-hud) |
| Thinking effort selector | [`rinco-pi-effort`](https://github.com/Rinisnotarobot/rinco-pi-effort) |
| Project stack rules | [`rinco-pi-rule`](https://github.com/Rinisnotarobot/rinco-pi-rule) |

Remove the legacy Git package, then install the replacements you want:

```bash
pi remove git:github.com/Rinisnotarobot/rinco-pi-settings
pi install npm:rinco-pi-sakura
pi install npm:rinco-pi-hud
```

Configuration and usage details now belong to each package's README. Report package-specific issues in the corresponding repository.
