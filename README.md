# pi-sakura-cyberdeck

Sakura Macaron visual pack for Pi containing only:

- the `sakura-macaron` truecolor theme
- the Sakura → sky cyberdeck startup header
- a complete dynamic Zentui footer

The footer preserves live model/context and token data, session cost and duration, Git branch/status/commit/metrics, runtime and project package detection, extension statuses, path/layout controls, icons, colors, and custom footer formats. It also integrates session/turn/thinking metadata, cache read/write totals, Codex subscription usage, MCP connectivity, Pi configuration counts, and live tool/agent-run activity. All integrated statuses use the Sakura palette; this package does not replace or pin Pi's editor.

## Documentation

Detailed Chinese documentation is available in [`docs/README.md`](docs/README.md):

- [Getting started](docs/getting-started.md)
- [Footer guide and template variables](docs/footer.md)
- [Configuration reference](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Theme and header](docs/theme-and-header.md)
- [Development and release](docs/development.md)
- [Troubleshooting](docs/troubleshooting.md)

## Requirements

- Pi `>= 0.80`
- truecolor terminal
- Nerd Font for configured icons
- optional Codex CLI for subscription-usage fallback

## Install

From GitHub:

```bash
pi install git:github.com/YOUR_NAME/pi-sakura-cyberdeck
```

From npm after publication:

```bash
pi install npm:pi-sakura-cyberdeck
```

Local test:

```bash
pi install ./pi-sakura-cyberdeck
```

Then open `/settings` and select **sakura-macaron**.

> Pi packages execute with your user permissions. Review extension source before installing third-party packages.

## Footer settings

Run `/zentui` for the full interactive Footer settings UI. With an empty `footerFormat`, the built-in Footer uses two semantic rows: project/session information above and activity/usage information below. A non-empty template keeps the compatible single-row layout. `/zentui` controls colors, visibility, segments, extension-status placement/coloring, icons, path display, branch length, separators, and context rendering.

Direct commands:

```text
/zentui statusline enable|disable|toggle
/zentui format clear
/zentui format "$cwd on $git_branch $fill $context"
/codex-status [--refresh] [--timeout seconds]
```

Codex usage first uses Pi's OpenAI Codex authentication and falls back to `codex app-server` when available.

User overrides are stored at:

```text
~/.pi/agent/sakura-cyberdeck-zentui.json
```

Delete the file to restore defaults. Deprecated keys from older releases are ignored, while supported Footer settings in the same file continue to load.

Avoid running this package together with another extension that owns Pi's footer or a duplicate copy of its header. They compete for the same TUI surfaces.

## Customize branding

Edit `extensions/header/index.ts` and replace `SAKURA CYBERDECK`. The palette lives in `themes/sakura-macaron.json`; Footer defaults live in `extensions/zentui/config.ts`.

## Publish

```bash
npm run check
npm run pack:check
npm publish --access public
```

For Pi package gallery artwork, add a hosted PNG/WebP URL as `pi.image` in `package.json`.

## Credits

The Zentui Footer derives from `lmilojevicc/pi-zentui`, MIT licensed. See `NOTICE` and `licenses/pi-zentui-MIT.txt`.

## License

MIT
