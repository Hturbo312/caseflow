// 工作流改造新增词条（流水线条 / 预览卡 / 命令面板 / 导入入口 / 审阅键盘流 / 问AI / 产出）
export const pairs = {
  // 研究流水线条
  'ux.pipeline.aria': ['研究流水线', 'Research pipeline'],
  'ux.pipeline.label': ['研究流程', 'Workflow'],
  'ux.pipeline.dismiss': ['收起流程条', 'Hide workflow bar'],
  'ux.step.schema': ['定框架', 'Framework'],
  'ux.step.import': ['录案例', 'Import'],
  'ux.step.review': ['审数据', 'Review'],
  'ux.step.graph': ['探索', 'Explore'],
  'ux.step.analysis': ['比案例', 'Compare'],

  // 案例预览卡
  'ux.preview.aria': ['案例预览', 'Case preview'],
  'ux.preview.tag': ['预览', 'Preview'],
  'ux.preview.entities': ['实体 {count}', '{count} entities'],
  'ux.preview.relations': ['关系 {count}', '{count} relations'],
  'ux.preview.open': ['在中栏打开', 'Open in workspace'],
  'ux.preview.ask': ['问AI这个案例', 'Ask AI about this'],
  'ux.preview.askPrompt': ['请介绍案例「{name}」：它的更新策略是什么？有哪些证据缺口？', 'Introduce the case "{name}": what is its regeneration strategy, and where are the evidence gaps?'],

  // 命令面板
  'ux.cmd.aria': ['全局搜索与命令', 'Global search and commands'],
  'ux.cmd.placeholder': ['搜索案例、实体，或输入命令…', 'Search cases, entities, or type a command…'],
  'ux.cmd.empty': ['没有匹配结果', 'No matches'],
  'ux.cmd.gotoGraph': ['前往：知识图谱', 'Go to: Knowledge Graph'],
  'ux.cmd.gotoSchema': ['前往：动态模式', 'Go to: Dynamic Schema'],
  'ux.cmd.gotoCase': ['前往：案例审阅', 'Go to: Case Review'],
  'ux.cmd.gotoAnalysis': ['前往：跨案例分析', 'Go to: Cross-Case Analysis'],
  'ux.cmd.import': ['从文档导入案例', 'Import case from document'],
  'ux.cmd.review': ['前往：审阅队列', 'Go to: Review queue'],
  'ux.cmd.entityAskPrefix': ['请解释实体「', 'Please explain the entity "'],
  'ux.cmd.navigate': ['选择', 'Navigate'],
  'ux.cmd.run': ['执行', 'Run'],
  'ux.cmd.close': ['关闭', 'Close'],

  // 导入入口
  'ux.import.button': ['从文档导入', 'Import from doc'],
  'ux.import.title': ['文档导入向导', 'Document import wizard'],
  'ux.import.close': ['关闭导入向导', 'Close import wizard'],
  'ux.import.badge': ['演示', 'Demo'],

  // 审阅键盘流
  'ux.review.hints': ['← 拒绝 · → 通过 · ↑↓ 切换 · 空格看原文', '← Reject · → Approve · ↑↓ Navigate · Space Source'],
  'ux.review.progress': ['审阅进度', 'Review progress'],
  'ux.review.copyMd': ['复制为 Markdown', 'Copy as Markdown'],
  'ux.review.copied': ['已复制到剪贴板', 'Copied to clipboard'],

  // 图谱双链
  'ux.graph.openCase': ['打开案例', 'Open case'],
  'ux.graph.askNode': ['问AI这个实体', 'Ask AI about this'],
  'ux.graph.evidence': ['查看原文证据', 'View source evidence'],

  // 研究简报
  'ux.analysis.brief': ['生成研究简报', 'Generate research brief'],

  // Schema 工作区：版本管理折叠
  'ux.schema.advTitle': ['高级：版本管理', 'Advanced: Version management'],
  'ux.schema.advToggle': ['展开/收起版本管理', 'Toggle version management'],

  // 统一设置（顶栏 ⚙）
  'settings.title': ['设置', 'Settings'],
  'settings.close': ['关闭', 'Close'],
  'settings.ai': ['AI 配置', 'AI Configuration'],
  'settings.general': ['通用设置', 'General'],
  'settings.users': ['用户管理', 'User management'],
  'settings.usersHint': ['管理员可以管理账号：角色、禁用、重置密码与删除。', 'Admins manage accounts: roles, disabling, password reset and deletion.'],
  'settings.usersOpen': ['打开用户管理', 'Open user management'],
  'settings.language': ['界面语言', 'Language'],
  'settings.style': ['界面风格', 'Interface style'],
  'settings.styleCozy': ['舒适', 'Cozy'],
  'settings.styleCompact': ['紧凑', 'Compact'],
  'settings.styleHint': ['紧凑模式收窄间距与字号，适合大屏一屏浏览更多内容。', 'Compact mode tightens spacing and font sizes to fit more on screen.'],
};
