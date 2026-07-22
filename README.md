# pi-sakura-cyberdeck

Sakura Macaron visual pack for [Pi](https://pi.dev):

- `sakura-macaron` truecolor theme
- Sakura → sky cyberdeck startup header
- animated pastel Matrix rain while Pi works
- modified Zentui editor, prompt chrome, and Starship-style footer
- fixed bottom editor enabled by default

## Requirements

- Pi `>= 0.80`
- truecolor terminal
- Nerd Font for configured icons

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

Then open `/settings` and select **sakura-macaron**. Restart Pi once so fixed-editor chrome owns the full session.

> Pi packages execute with your user permissions. Review extension source before installing third-party packages.

## Commands

```text
/zentui                         interactive editor/footer settings
/sakura-matrix                 animation status
/sakura-matrix on|off
/sakura-matrix preview
/sakura-matrix fps <8-18>
/sakura-matrix density <0.45-0.95>
```

User overrides are stored separately from other Zentui installs:

```text
~/.pi/agent/sakura-cyberdeck-zentui.json
~/.pi/agent/sakura-cyberdeck-matrix.json
```

Delete either file to restore this package's defaults.

## Fixed-editor warning

Fixed editor uses alternate-screen and terminal mouse reporting. While mouse scrolling is enabled, native terminal selection, URL clicking, and normal scrollback may be unavailable.

Disable it with:

```text
/zentui fixed-editor disable
```

Avoid running this package together with `pi-zentui`, `pi-powerline-footer`, `@tifan/pi-fixed-editor`, `pi-sticky-input`, or duplicate copies of its header/matrix extensions. They compete for the same TUI surfaces.

## Customize branding

Edit `extensions/header/index.ts` and replace `SAKURA CYBERDECK`. Palette lives in `themes/sakura-macaron.json`; Zentui defaults live in `extensions/zentui/config.ts`.

## Publish

```bash
npm run check
npm run pack:check
npm publish --access public
```

For Pi package gallery artwork, add a hosted PNG/WebP URL as `pi.image` in `package.json`.

## Credits

Zentui portion derives from [lmilojevicc/pi-zentui](https://github.com/lmilojevicc/pi-zentui), MIT licensed. See [NOTICE](NOTICE) and [licenses/pi-zentui-MIT.txt](licenses/pi-zentui-MIT.txt).

## License

MIT
