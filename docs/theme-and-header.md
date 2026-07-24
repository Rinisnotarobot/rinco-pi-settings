# 主题与 Header

## Sakura Macaron 主题

主题文件：

```text
themes/sakura-macaron.json
```

主题名：

```text
sakura-macaron
```

在 Pi 的 `/settings` 中选择该主题即可启用。

## 色板

| 变量 | 色值 | 用途倾向 |
| --- | --- | --- |
| `bg` | `#14111A` | 页面背景 |
| `surface` | `#1E1826` | 卡片/表面 |
| `surfaceSoft` | `#251D2D` | 柔和层级 |
| `surfaceRaised` | `#2D2438` | 选择和抬升区域 |
| `text` | `#F7EEF8` | 主文本 |
| `textSoft` | `#D8CADC` | 次级文本 |
| `muted` | `#A99BAE` | 弱化文本 |
| `dim` | `#716879` | 最低强调 |
| `sakura` | `#F2A7C6` | 主强调色 |
| `sakuraIro` | `#FCC9B9` | Sakura 偏暖色 |
| `petal` | `#EFC3E6` | 花瓣色 |
| `peach` | `#F6BC9A` | 类型、代码等 |
| `lavender` | `#C7B8F5` | 变量、高思考等级 |
| `sky` | `#9FD3F2` | 链接、函数、工具标题 |
| `mint` | `#AEE5C5` | 成功、字符串 |
| `butter` | `#F3D98B` | 警告、数字 |
| `coral` | `#FF8FA3` | 错误、删除 |

主题覆盖 Pi 的：

- 通用边框、文本、强调、成功、警告和错误；
- User/custom message；
- Tool title/output/background；
- Markdown heading/link/code/quote/list/hr；
- Diff added/removed/context；
- 语法高亮；
- thinking off 到 max；
- Bash mode；
- HTML/页面导出背景。

主题色是独立于 Footer 颜色配置的。Footer 默认 `colorSources.starship=terminal`，因此默认 Hex 样式直接输出 truecolor；切换到 `theme` 后会更多地使用当前 Pi 主题 token。

## Header

入口：

```text
extensions/header/index.ts
```

### 生命周期

- `session_start`：有 UI 时调用 `ctx.ui.setHeader()`；
- `session_shutdown`：调用 `ctx.ui.setHeader(undefined)`；
- Headless / 非 UI 环境不安装。

### 渲染

Header 包含：

1. 9 行 Unicode 图案；
2. Sakura → Sky 的逐字符 24-bit RGB 渐变；
3. 一条渐变分隔轨；
4. Lavender → Peach 的粗体 `SAKURA CYBERDECK` 标题；
5. 根据终端宽度进行裁剪和居中；
6. 根据终端可用行数增加顶部空行，近似垂直居中。

当 `width <= 0` 时返回空内容。终端行数读取失败时按 0 处理，不影响会话。

## 品牌定制

### 修改标题

编辑：

```ts
// extensions/header/index.ts
const telemetry = "◈  SAKURA CYBERDECK  ◈";
```

替换文字后注意终端宽度和 Unicode glyph 的实际显示宽度。

### 修改渐变

Header 内使用四组 RGB：

```ts
const sakura = [242, 167, 198];
const peach = [252, 201, 185];
const lavender = [199, 184, 245];
const sky = [159, 211, 242];
```

图案使用 Sakura → Sky，标题使用 Lavender → Peach。

### 修改图案

替换 `ANIME_ART` 数组即可。建议：

- 保持每行宽度接近；
- 在窄终端验证裁剪；
- 避免依赖普通字体缺失的 glyph；
- 注意当前宽度按 Unicode code point 而不是终端 cell 计算。

### 修改主题

编辑 `themes/sakura-macaron.json`：

1. 优先调整 `vars`；
2. `colors` 中引用变量名；
3. 保留 Pi 主题 Schema 所需颜色键；
4. 运行 `npm run check`；
5. 在真实 Pi TUI 中验证消息、Markdown、工具、Diff 和不同 thinking level。

## Truecolor 与字体兼容

- Header 直接输出 `38;2;r;g;b` ANSI 序列，需要 truecolor；
- 主题与 Footer 中的 Hex 颜色同样依赖终端 truecolor；
- Header Unicode 图案不要求 Nerd Font，但终端字体必须包含相应字符；
- Footer 默认图标依赖 Nerd Font，可用 `/zentui` 切换 `ascii`。
