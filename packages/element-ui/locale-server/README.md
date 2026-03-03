# 国际化配置持久化服务

## 功能说明

将 Vue 表单设计器的国际化配置持久化到文件，支持：
- ✅ 系统启动时自动加载语言包
- ✅ 新增词条时实时更新文件
- ✅ 批量导入时实时更新文件
- ✅ 批量删除时实时更新文件

## 文件结构

```
packages/element-ui/
├── locale-server/
│   ├── server.js          # Node.js 后端服务
│   └── package.json       # 服务依赖
├── src/locale/
│   ├── custom-locale.json # 自定义语言包（持久化文件）
│   ├── zh-cn.js           # 默认中文包
│   └── en.js              # 默认英文包
└── src/components/language/
    └── LanguageConfig.vue # 前端配置组件（已集成持久化）
```

## 快速启动

### 1. 安装依赖

```bash
cd /home/openclaw/.openclaw/workspace/branch-designer-v2/packages/element-ui/locale-server
pnpm install
# 或 npm install
```

### 2. 启动服务

```bash
pnpm start
# 或 node server.js
```

服务将运行在 `http://localhost:3080`

### 3. 启动前端开发服务器

```bash
cd /home/openclaw/.openclaw/workspace/branch-designer-v2
pnpm run dev:ele
```

访问 `http://localhost:8080` 即可使用带持久化的国际化配置功能。

## API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/locale` | 读取语言包 |
| POST | `/api/locale` | 保存语言包（全量） |
| PATCH | `/api/locale/:lang/:key` | 更新单个词条 |
| PATCH | `/api/locale/:lang/batch` | 批量导入 |
| DELETE | `/api/locale/:lang/batch` | 批量删除 |

## 语言包格式

```json
{
  "zh-cn": {
    "L_NONACC": "停息指示",
    "TEXT151": "\"Advised Through\" Bank",
    "L_TAX_RATE_1": "税率"
  },
  "en": {
    "L_NONACC": "Non-accrual Indicator",
    "TEXT151": "\"Advised Through\" Bank",
    "L_TAX_RATE_1": "Tax Rate"
  }
}
```

## 降级模式

如果后端服务未启动，前端会自动降级到内存模式，并在控制台显示警告：
```
⚠️ 无法连接持久化服务，使用内存模式
```

此时所有操作仅在内存中进行，刷新页面后数据会丢失。

## 注意事项

1. **端口占用**：确保 3080 端口未被占用
2. **CORS**：服务已启用 CORS，允许前端跨域访问
3. **文件权限**：确保 `custom-locale.json` 可读写
4. **数据备份**：建议定期备份 `custom-locale.json`

## 开发日志

- 2026-03-02: 初始版本，支持基础 CRUD 操作
- 后续可添加：版本管理、差异对比、导出导入等
