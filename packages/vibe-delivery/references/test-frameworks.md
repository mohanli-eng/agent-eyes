# 测试框架参考

本文档提供各测试框架的详细配置和使用指南，供 `/setup-test` 和 `/gen-test` 指令参考。

---

## 一、前端测试框架

### 1. Vitest (Vite 项目首选)

#### 安装

```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event jsdom
```

#### 配置文件 (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

#### 测试环境配置 (test-setup.ts)

```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})
```

#### 常用断言

```typescript
// DOM 断言
expect(element).toBeInTheDocument()
expect(element).toHaveTextContent('文本')
expect(element).toHaveClass('className')
expect(element).toBeDisabled()
expect(element).toBeVisible()

// 值断言
expect(value).toBe(expected)
expect(value).toEqual(expected)
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toContain(item)
expect(value).toHaveLength(length)

// 函数断言
expect(fn).toHaveBeenCalled()
expect(fn).toHaveBeenCalledTimes(times)
expect(fn).toHaveBeenCalledWith(arg1, arg2)

// 异步断言
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow()
```

### 2. Jest (CRA / Next.js 项目)

#### 安装

```bash
npm install -D jest @testing-library/react @testing-library/user-event @testing-library/jest-dom jest-environment-jsdom identity-obj-proxy
```

#### 配置文件 (jest.config.js)

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './'
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ]
}

module.exports = createJestConfig(customJestConfig)
```

#### 测试环境配置 (jest.setup.js)

```javascript
import '@testing-library/jest-dom'
```

### 3. React Testing Library

#### 渲染组件

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Component } from './Component'

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component prop="value" />)
    expect(screen.getByText('内容')).toBeInTheDocument()
  })
})
```

#### 查询元素

```typescript
// 优先级从高到低
screen.getByRole('button', { name: '提交' })
screen.getByLabelText('用户名')
screen.getByPlaceholderText('请输入')
screen.getByText('内容')
screen.getByDisplayValue('显示值')
screen.getByAltText('图片描述')
screen.getByTitle('标题')
screen.getByTestId('test-id')  // 最后选择
```

#### 用户交互

```typescript
import userEvent from '@testing-library/user-event'

it('handles user interaction', async () => {
  const user = userEvent.setup()
  render(<Form />)

  await user.type(screen.getByLabelText('用户名'), 'testuser')
  await user.click(screen.getByRole('button', { name: '提交' }))

  expect(screen.getByText('提交成功')).toBeInTheDocument()
})
```

#### 异步操作

```typescript
import { waitFor, findByText } from '@testing-library/react'

it('loads data', async () => {
  render(<DataComponent />)

  // 等待元素出现
  await waitFor(() => {
    expect(screen.getByText('数据加载完成')).toBeInTheDocument()
  })

  // 或使用 findBy
  const element = await screen.findByText('数据加载完成')
  expect(element).toBeInTheDocument()
})
```

---

## 二、E2E 测试框架

### Playwright

#### 安装

```bash
npm install -D @playwright/test
npx playwright install
```

#### 配置文件 (playwright.config.ts)

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  }
})
```

#### 页面操作

```typescript
import { test, expect } from '@playwright/test'

test('user login flow', async ({ page }) => {
  // 导航
  await page.goto('/login')

  // 填写表单
  await page.fill('[name="username"]', 'testuser')
  await page.fill('[name="password"]', 'password123')

  // 点击按钮
  await page.click('button[type="submit"]')

  // 等待导航
  await page.waitForURL('/dashboard')

  // 验证结果
  await expect(page.locator('.welcome')).toContainText('欢迎')
})
```

#### 元素定位

```typescript
// 角色定位（推荐）
page.getByRole('button', { name: '提交' })
page.getByRole('textbox', { name: '用户名' })
page.getByRole('link', { name: '首页' })

// 文本定位
page.getByText('欢迎')
page.getByText(/欢迎.*/)

// 标签定位
page.getByLabel('用户名')

// 占位符定位
page.getByPlaceholder('请输入')

// 测试 ID
page.getByTestId('submit-button')
```

#### 等待策略

```typescript
// 等待元素出现
await page.waitForSelector('.loaded')

// 等待元素状态
await expect(page.locator('.button')).toBeVisible()
await expect(page.locator('.button')).toBeEnabled()
await expect(page.locator('.input')).toHaveValue('text')

// 等待网络请求
await page.waitForResponse('**/api/data')

// 等待请求完成
await page.waitForLoadState('networkidle')
```

#### Mock API

```typescript
test('handles API error', async ({ page }) => {
  // Mock 错误响应
  await page.route('**/api/data', route => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Server Error' })
    })
  })

  await page.goto('/data')
  await expect(page.locator('.error')).toBeVisible()
})

test('mock API response', async ({ page }) => {
  await page.route('**/api/users', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ])
    })
  })

  await page.goto('/users')
  await expect(page.locator('.user-list li')).toHaveCount(2)
})
```

#### 截图和录制

```typescript
test('screenshot on failure', async ({ page }) => {
  await page.goto('/')

  // 手动截图
  await page.screenshot({ path: 'screenshot.png' })

  // 全页面截图
  await page.screenshot({ path: 'full.png', fullPage: true })

  // 元素截图
  await page.locator('.component').screenshot({ path: 'component.png' })
})
```

---

## 三、后端测试框架

### 1. Jest (Node.js)

#### 安装

```bash
npm install -D jest @types/jest ts-jest
```

#### 配置文件 (jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  coverageDirectory: 'coverage'
}
```

#### API 测试示例

```typescript
import request from 'supertest'
import app from '../src/app'

describe('API Endpoints', () => {
  it('GET /api/users should return users', async () => {
    const response = await request(app)
      .get('/api/users')
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).toBeInstanceOf(Array)
  })

  it('POST /api/users should create user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'Test User', email: 'test@example.com' })
      .expect(201)

    expect(response.body).toHaveProperty('id')
    expect(response.body.name).toBe('Test User')
  })
})
```

### 2. Pytest (Python)

#### 安装

```bash
pip install pytest pytest-cov pytest-asyncio httpx
```

#### 配置文件 (pytest.ini)

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
```

#### 测试示例

```python
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_get_users():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/users")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_create_user():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/users",
            json={"name": "Test User", "email": "test@example.com"}
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["name"] == "Test User"
```

---

## 四、测试最佳实践

### 1. 测试命名

```typescript
// 好的命名
it('should return user when valid id is provided', () => {})
it('should throw error when user not found', () => {})

// 不好的命名
it('test1', () => {})
it('works', () => {})
```

### 2. AAA 模式

```typescript
it('should calculate total price', () => {
  // Arrange - 准备
  const items = [
    { price: 100, quantity: 2 },
    { price: 50, quantity: 1 }
  ]

  // Act - 执行
  const total = calculateTotal(items)

  // Assert - 验证
  expect(total).toBe(250)
})
```

### 3. 测试隔离

```typescript
describe('UserService', () => {
  let service: UserService

  beforeEach(() => {
    service = new UserService()
  })

  afterEach(() => {
    // 清理
    service.cleanup()
  })

  it('should create user', () => {
    // 每个测试都有独立的 service 实例
  })
})
```

### 4. Mock 外部依赖

```typescript
// Mock 模块
vi.mock('@/api/users', () => ({
  getUsers: vi.fn(() => Promise.resolve([{ id: 1, name: 'User' }]))
}))

// Mock 函数
const mockCallback = vi.fn()
component.onClick(mockCallback)
expect(mockCallback).toHaveBeenCalled()
```

### 5. 测试边界条件

```typescript
describe('validateEmail', () => {
  it('should return true for valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true)
  })

  it('should return false for invalid email', () => {
    expect(validateEmail('invalid')).toBe(false)
    expect(validateEmail('test@')).toBe(false)
    expect(validateEmail('@example.com')).toBe(false)
  })

  it('should handle edge cases', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail(null)).toBe(false)
    expect(validateEmail(undefined)).toBe(false)
  })
})
```

---

## 五、测试覆盖率目标

| 类型 | 目标覆盖率 | 说明 |
|------|-----------|------|
| 工具函数 | 100% | 纯函数，易于测试 |
| 业务逻辑 | 80%+ | 核心功能必须覆盖 |
| 组件 | 70%+ | 重点测试交互逻辑 |
| API 端点 | 90%+ | 包含错误处理 |
| E2E 场景 | 关键流程 | 核心用户路径 |
