# Mock 策略

| 测试层级 | Mock 策略 | 说明 |
| -------- | --------- | ---- |
| 单元测试 | 完全 Mock | URL pattern、token 截断、rating 计算等纯逻辑。不涉及浏览器。 |
| 集成测试 | 真实浏览器 + 本地 Fixture | 使用 Playwright headless Chromium 加载本地 fixture HTML 页面。通过内置 HTTP server 提供可控场景（console error、网络请求、DOM 结构等）。不依赖外部网络。 |
| E2E 测试 | 真实部署 URL | 指向 Vercel/Netlify 部署的公开 URL。不在此 PRD 范围自动化，标记为手动验证。 |
