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

  // 统一 Copilot：材料能力内化（附件登记 + 整理/提取动作）
  'ux.mat.attach': ['登记来源材料（PDF/DOCX/TXT）', 'Attach source materials (PDF/DOCX/TXT)'],
  'ux.mat.registering': ['正在登记来源材料…', 'Registering source materials…'],
  'ux.mat.drafting': ['正在整理来源与冲突…', 'Organizing sources and conflicts…'],
  'ux.mat.extracting': ['正在抽取候选知识…', 'Extracting candidate knowledge…'],
  'ux.mat.registered': ['已登记 {n} 份来源材料（当前共 {total} 份）。可以直接让我整理。', 'Registered {n} source(s) ({total} in total). Ask me to organize them anytime.'],
  'ux.mat.fileTooBig': ['文件超过 20 MB', 'File exceeds 20 MB'],
  'ux.mat.noText': ['未识别出文字，扫描件请先 OCR', 'No text recognized; run OCR first for scanned files'],
  'ux.mat.fileFail': ['解析失败：{msg}', 'Failed to parse: {msg}'],
  'ux.mat.noCase': ['请先在右侧打开或新建一个案例，再登记材料。', 'Open or create a case on the right before attaching materials.'],
  'ux.mat.busy': ['当前案例有材料任务进行中，请稍候。', 'A material task is already running for this case; please wait.'],
  'ux.mat.noSources': ['当前案例还没有已登记的来源材料，请先用附件按钮登记。', 'No sources registered for this case yet; attach files first.'],
  'ux.mat.tooBig': ['材料超过本轮 6 万字符处理上限，不会静默截断，请先分批整理。', 'Materials exceed the 60,000-character limit (no silent truncation); organize in smaller batches.'],
  'ux.mat.notConfirmed': ['最新整理稿尚未在中栏确认，请先审阅确认后再提取候选知识。', 'The latest draft is not confirmed yet; review it in the workspace before extraction.'],
  'ux.mat.aiInvalid': ['AI 未返回有效结构，未保存任何结果，请重试。', 'AI returned no valid structure; nothing was saved. Please retry.'],
  'ux.mat.draftOk': ['整理稿已生成（{n} 段）并保存到服务器，请在中栏审阅确认。', 'Draft generated ({n} paragraphs) and saved; review and confirm it in the workspace.'],
  'ux.mat.extractOk': ['候选知识已提取（{n} 条），请在中栏核查后写入图谱。', 'Extracted {n} candidate item(s); verify them in the workspace before writing to the graph.'],
  'ux.mat.failed': ['任务失败：{msg}', 'Task failed: {msg}'],

  // 左栏拖宽手柄
  'ux.rail.resize': ['拖动调整左栏宽度，双击恢复默认', 'Drag to resize the rail; double-click to reset'],
};
