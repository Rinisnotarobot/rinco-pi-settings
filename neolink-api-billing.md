# Neolink (Token Switch) 额度查询接口文档

## 1. 背景

- 站点：`https://www.neolink.com`（前端为静态 SPA，标题“智速双擎, token无界”）
- 真实产品名：**Token Switch**（基于开源项目 [QuantumNous/new-api](https://github.com/QuantumNous/new-api)，原 One API 生态，OpenAI 接口聚合管理网关）
- 前端页面直接访问 `/v1/...`、`/api/...` 等路径会被 SPA 兜底路由拦截，统一返回首页 HTML，**不是真正的后端接口**。
- 真正的后端 API 前缀通过前端运行时配置文件确认：

  ```bash
  curl -s https://www.neolink.com/config.js
  ```

  关键字段：

  ```js
  window.__RUNTIME_CONFIG__ = {
    VITE_SERVER_URL: 'https://neolink.com/backend/',
    VITE_API_URL: 'https://neolink.com/api',
    VITE_API_DOCS_URL: 'https://neolink.com/docs/instruction-manual/01-overview',
    ...
  }
  ```

  → 所有后端接口都要加 **`/backend/`** 前缀，例如 `https://neolink.com/backend/v1/...`。

## 2. 鉴权

- 认证方式：`Authorization: Bearer <API_KEY>` 请求头
- 本环境中密钥保存在环境变量 `TOKEN_SWITCH_API_KEY` 中，使用时直接引用，不要打印明文：

  ```bash
  curl -H "Authorization: Bearer $TOKEN_SWITCH_API_KEY" <endpoint>
  ```

> **安全须知**：本文件是提交进仓库的公开文档。
>
> - 绝不要把真实 API Key 粘贴到这里，只引用 `$TOKEN_SWITCH_API_KEY`；
> - 下文所有响应示例均为占位数值，不要用真实账户的额度或用量替换；
> - 排查时不要把 `curl` 的原始响应直接贴进本文件或 Issue。

## 3. 额度查询接口

### 3.1 获取订阅额度（总额度 / 硬限制）

- **路径**：`GET /backend/v1/dashboard/billing/subscription`
- **说明**：兼容 OpenAI SDK 的账单面板接口，返回软/硬限制额度（单位 USD）
- **示例**：

  ```bash
  curl -s -H "Authorization: Bearer $TOKEN_SWITCH_API_KEY" \
       https://neolink.com/backend/v1/dashboard/billing/subscription
  ```

- **响应字段**：

  | 字段 | 类型 | 说明 |
  |---|---|---|
  | `object` | string | 固定值 `billing_subscription` |
  | `has_payment_method` | bool | 是否绑定支付方式 |
  | `soft_limit_usd` | number | 软限制额度（美元） |
  | `hard_limit_usd` | number | 硬限制总额度（美元），需减去累计已用额度得到当前可用额度 |
  | `system_hard_limit_usd` | number | 系统硬限制额度（美元） |
  | `access_until` | number | Token 过期时间戳，`0` 表示无限制 |

- **响应示例（占位数值）**：

  ```json
  {
    "object": "billing_subscription",
    "has_payment_method": true,
    "soft_limit_usd": 1000.0,
    "hard_limit_usd": 1000.0,
    "system_hard_limit_usd": 1000.0,
    "access_until": 0
  }
  ```

### 3.2 获取已用量

- **路径**：`GET /backend/v1/dashboard/billing/usage`
- **说明**：返回累计使用量，单位是“分”（OpenAI 兼容格式，除以 100 得美元）
- **示例**：

  ```bash
  curl -s -H "Authorization: Bearer $TOKEN_SWITCH_API_KEY" \
       https://neolink.com/backend/v1/dashboard/billing/usage
  ```

- **响应示例（占位数值）**：

  ```json
  {"object": "list", "total_usage": 25000.0}
  ```

  → 折算美元：`25000.0 / 100 = $250.00`

### 3.3 计算剩余额度

```
总额度(USD)    = hard_limit_usd
已用额度(USD)  = total_usage / 100
可用额度(USD)  = hard_limit_usd - total_usage / 100
```

按上述占位示例计算：`1000.0 - 25000.0 / 100 = $750.00`。

## 4. 其他相关接口（辅助排查用）

| 路径 | 方法 | 说明 |
|---|---|---|
| `/backend/api/status` | GET | 站点公开配置状态，可用于确认后端可达、无需鉴权 |
| `/backend/api/user/self` | GET | 获取用户信息，需要**用户登录 Token**（不是 API Key），用 API Key 调用会返回 `401 access token 无效` |

## 5. 一键查询脚本

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE="https://neolink.com/backend"
AUTH="Authorization: Bearer ${TOKEN_SWITCH_API_KEY:?请先设置 TOKEN_SWITCH_API_KEY}"

sub=$(curl -s -H "$AUTH" "$BASE/v1/dashboard/billing/subscription")
usage=$(curl -s -H "$AUTH" "$BASE/v1/dashboard/billing/usage")

echo "订阅信息: $sub"
echo "使用信息: $usage"
```

## 6. 排错记录

- `www.neolink.com/api-docs` 页面直接访问返回 SPA 首页，不含真实文档；真实接口文档在 `https://neolink.com/docs/instruction-manual/01-overview`（VitePress 站点）。
- 直接请求 `https://neolink.com/v1/dashboard/billing/subscription`（不带 `/backend/` 前缀）会被前端路由拦截，返回 200 但是 HTML 首页，容易误判为“接口不存在”。**务必加 `/backend/` 前缀**。
- 该后端与开源项目 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 的“账户计费面板模块”接口规范完全一致，字段可参考其[官方文档](https://doc.newapi.pro/api/fei-account-billing-panel)。
