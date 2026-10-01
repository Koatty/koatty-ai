# http-action

为已有 Koatty 应用添加一个 HTTP 接口（设计 §6.1 首批场景 2）。

- 组合原语：koatty_cli `renderHttpActionApi`（DTO + 单动作 Controller + Service 引用/新建）。
- 输入：结构参数（见 `recipe.json` inputSchema），不是自然语言，也不接收脚本。
- 输出：签名计划（planId + changeset），`apply --yes` 后落盘。
- 待实现项：业务规则在 Service 中实现；工具生成的是框架接线。

## 不支持的组合（写入前拒绝）

- GET/DELETE 携带请求体 DTO。
- reference 模式下服务类或方法不存在（`SERVICE_NOT_FOUND` / `SERVICE_METHOD_MISSING`）。
- 目标文件已存在（`FILE_EXISTS`）。

## 用法

```sh
npx koatty-ai plan --recipe http-action --params '{"controller":{"name":"OrderController","basePath":"/orders"},"action":{"name":"create","method":"POST","path":"/"},"dto":{"name":"CreateOrderDto","fields":{"sku":{"type":"string","required":true,"length":64}}},"service":{"name":"OrderService","mode":"create","method":"create"}}'
npx koatty-ai apply --planId <returned-id> --yes
npx koatty-ai check
```

MCP 工具：`koatty_ai_plan`（recipe+params）→ `koatty_ai_apply`（planId）。

`recipe.json` 的 `example` 与本文件说明由 `tests/regression/R-01.http-action-recipe.test.ts` 做契约回归：能力未实现时文档不得教 Agent 调用。
