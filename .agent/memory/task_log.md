# 任务日志

<!-- updated: 2026-03-24 -->

## 任务 #1: 前后端打通 (2026-03-24)

### 描述
前后端未连接，数据不持久化，图谱和案例无法联动。

### 分析过程
1. 发现 store 使用纯内存数据
2. 后端 API 已存在但未被调用
3. Nginx 缺少 `/api` 代理配置

### 解决方案
1. 创建 `src/services/api.js`
2. 修改 store 添加 API 调用
3. 配置 Nginx 反向代理
4. 增大图谱可视化尺寸

### 修改文件
- `src/services/api.js` (新建)
- `src/store/index.js`
- `src/pages/CaseFlow.jsx`
- `src/components/CaseDetail.jsx`
- `src/components/KnowledgeGraphCanvas.jsx`
- `src/pages/CaseFlow.css`
- `vite.config.js`
- `/etc/nginx/conf.d/hturbo.conf`

### 踩坑引用
- pitfalls.md #1, #2, #3

### 后续事项
- [ ] 完善数据库持久化逻辑
- [ ] 添加错误处理和 loading 状态
- [ ] 考虑使用 pm2 管理后端进程