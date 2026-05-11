# CaseFlow 架构

<!-- updated: 2026-03-24 -->
<!-- confidence: high -->
<!-- source: code_reading -->

## 目录结构

```
hturbo-react/
├── src/
│   ├── components/          # UI 组件
│   │   ├── SchemaArchitect.jsx   # Schema 建模
│   │   ├── CaseDetail.jsx        # 案例详情
│   │   ├── KnowledgeGraphCanvas.jsx  # 知识图谱
│   │   └── AICopilot.jsx         # AI 助手
│   ├── pages/
│   │   └── CaseFlow.jsx     # 主页面（三栏布局）
│   ├── store/
│   │   └── index.js         # Zustand stores
│   ├── services/
│   │   └── api.js           # API 调用封装
│   ├── App.jsx              # 路由配置
│   └── main.jsx             # 入口
├── server/
│   └── index.js             # Express 后端
├── dist/                    # 构建输出
└── nginx 配置               # /etc/nginx/conf.d/hturbo.conf
```

## 模块依赖

```
App.jsx
  └── CaseFlow.jsx (主页面)
        ├── SchemaArchitect (左栏)
        ├── KnowledgeGraphCanvas (中栏)
        ├── AICopilot (中栏切换)
        └── 案例卡片列表 (右栏)

所有组件 → store/index.js (Zustand)
```

## 数据流

```
用户操作 → Zustand Store → 组件重渲染
                ↓
           API 调用 (可选) → PostgreSQL
```

## 三栏布局

- **左栏 (420px)**: Schema建模 / 案例详情 切换
- **中栏 (flex-1)**: 知识图谱 / AI助手 切换
- **右栏 (340px)**: 案例卡片列表