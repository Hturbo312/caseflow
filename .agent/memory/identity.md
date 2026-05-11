# CaseFlow 项目身份

<!-- updated: 2026-03-24 -->
<!-- confidence: high -->
<!-- source: code_reading -->

## 配置

- **项目根路径**: /opt/node-apps/hturbo-react
- **项目类型**: 前端 SPA + 后端 API
- **主要语言**: JavaScript (React)
- **构建工具**: Vite
- **后端**: Node.js + Express + PostgreSQL

## 角色定义

这是一个**城市更新案例知识管理平台**，核心功能：
1. Schema 建模 - 定义实体类型和关系
2. 案例管理 - 结构化案例数据
3. 知识图谱 - 可视化实体关系
4. AI 助手 - GraphRAG 智能问答

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + Vite |
| 状态管理 | Zustand |
| 路由 | React Router DOM |
| 样式 | Tailwind CSS |
| 动画 | Framer Motion |
| 图谱 | react-force-graph-2d |
| 后端 | Express + pg (PostgreSQL) |
| 部署 | Nginx 反向代理 |

## 关键文件

- `src/store/index.js` - 全局状态管理
- `src/pages/CaseFlow.jsx` - 主页面
- `src/components/` - 四大组件
- `server/index.js` - 后端 API
- `vite.config.js` - 构建配置