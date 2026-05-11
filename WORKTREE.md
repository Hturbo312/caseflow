# 主工作区

## 分支
`main`

## 用途
- 主开发分支
- 整合前端和后端的修改
- 集成测试

## 当前进度
- 后端重构已完成（模块化拆分）
- 前端优化进行中
- Agent 响应速度已优化

## Worktree 列表
- `/opt/node-apps/hturbo-react-frontend` - 前端开发
- `/opt/node-apps/hturbo-react-backend` - 后端开发

## 使用说明
```bash
# 查看所有 worktree
git worktree list

# 在各 worktree 中工作
cd /opt/node-apps/hturbo-react-frontend
# ... 进行前端修改 ...

# 完成后合并
git checkout main
git merge feature/frontend-optimization

# 清理 worktree
git worktree remove ../hturbo-react-frontend
```