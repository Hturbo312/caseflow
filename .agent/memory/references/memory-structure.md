# 记忆目录结构

```
.agent/memory/
├── identity.md      # L0: 项目身份与配置 (始终加载)
├── architecture.md  # L1: 架构概览 (始终加载)
├── conventions.md   # L1: 开发惯例 (始终加载)
├── pitfalls.md      # L2: 踩坑记录
├── task_log.md      # L3: 任务日志
├── _index.md        # 索引与路由表
├── modules/         # L2: 模块详情
│   └── {name}.md
└── references/      # 参考资料
    └── memory-structure.md
```

## 加载层级

| 层级 | 文件 | 加载时机 |
|------|------|----------|
| L0 | identity.md | 每次会话 |
| L1 | architecture.md, conventions.md | 每次会话 |
| L2 | modules/*.md, pitfalls.md | 任务相关时 |
| L3 | task_log.md | 反思阶段 |

## 文件模板

### modules/{name}.md

```markdown
# {模块名}

<!-- updated: YYYY-MM-DD -->
<!-- confidence: high/medium/low -->
<!-- source: code_reading/debugging/pr_review -->

## 职责

## 关键文件

## 公开接口

## 依赖

## 注意事项
```

### pitfalls 条目

```markdown
## #{n}. {标题}

### 现象
### 根因
### 修复
### 教训
### 相关文件
```