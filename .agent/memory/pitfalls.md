# CaseFlow 踩坑记录

<!-- updated: 2026-03-24 -->
<!-- confidence: high -->
<!-- source: debugging -->

## 1. 前后端未打通导致数据不持久

### 现象
删除实体后刷新页面，数据恢复原状。图谱和案例无法联动。

### 根因
前端使用 Zustand 内存状态，未调用后端 API。`store/index.js` 只有本地数据操作，没有 API 集成。

### 修复
1. 创建 `src/services/api.js` 封装 API 调用
2. Store 中添加 `loadCases`, `loadSchemas` 等异步方法
3. Nginx 添加 `/api` 代理到后端

### 教训
- 新项目应尽早验证前后端集成
- 不要同时开发前后端而不做集成测试

### 相关文件
- `src/store/index.js`
- `src/services/api.js`
- `server/index.js`

---

## 2. Nginx 配置缺失 API 代理

### 现象
前端访问 `/api/*` 返回 404。

### 根因
Nginx 只配置了静态文件服务，没有 `/api` location 代理到后端。

### 修复
```nginx
location /api {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}
```

### 教训
- SPA 部署必须配置 API 代理
- 检查 Nginx 配置文件冲突（sites-available vs conf.d）

### 相关文件
- `/etc/nginx/conf.d/hturbo.conf`

---

## 3. 图谱可视化尺寸太小

### 现象
知识图谱画布太小，看不清节点。

### 根因
CSS 未设置最小高度，ForceGraph2D 组件需要明确尺寸。

### 修复
```css
.caseflow-main-content {
  min-height: 600px;
  display: flex;
  flex-direction: column;
}
```

### 相关文件
- `src/pages/CaseFlow.css`
- `src/components/KnowledgeGraphCanvas.jsx`