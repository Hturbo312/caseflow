// 中英成对词条
// 负责文件：Workspace/CaseWorkspace.jsx、CaseManagement/utils（caseHelpers.js / constants.js）、
// ClassicCaseFlow.jsx、App.jsx、ErrorBoundary/ErrorBoundary.jsx
// 已复用现有 key（不在此处重复）：schema.overview、pipeline.approved、pipeline.pending、
// case.entityCount、case.linkCount、case.yearSuffix、compare.loading、entity.save、common.cancel、
// case.planning、case.inProgress、case.completed、tab.results、tab.manual、
// case.sortRecent、case.sortCreated、case.sortName、case.sortStatus、
// case.unknownYear、case.unknownLocation、session.daysAgoShort、session.today、app.loading
export const pairs = {
  // ==== CaseWorkspace.jsx ====
  // 子 Tab
  'ws.tab.graph': ['图谱', 'Graph'],
  'ws.tab.source': ['原文与分段', 'Source & Segments'],
  'ws.tab.evidence': ['证据', 'Evidence'],
  'ws.tab.review': ['审核', 'Review'],
  // 证据/审核状态
  'ws.status.limited': ['有限支持', 'Limited support'],
  'ws.status.blocked': ['受阻', 'Blocked'],
  'ws.status.notEvidenced': ['资料未说明', 'Not stated in sources'],
  'ws.status.rejected': ['已拒绝', 'Rejected'],
  // 案例分级
  'ws.caseStatus.core': ['核心', 'Core'],
  'ws.caseStatus.candidate': ['候选', 'Candidate'],
  'ws.caseStatus.boundary': ['边界', 'Boundary'],
  'ws.caseStatus.experiment': ['实验', 'Experiment'],
  // 空态
  'ws.empty.title': ['在右侧案例库中单击案例', 'Click a case in the Case Library on the right'],
  'ws.empty.hint': ['案例详情将在中栏打开（概览 / 原文与分段 / 证据 / 审核）', 'Case details open in the middle panel (Overview / Source & Segments / Evidence / Review)'],
  // 上下文任务（传给 AI 助手）
  'ws.task.review': ['关系/实体审核', 'Relation/entity review'],
  'ws.task.caseTab': ['案例{tab}', 'Case {tab}'],
  // 概览
  'ws.overview.typeCount': ['对象类别', 'Object Types'],
  'ws.overview.typeDist': ['知识对象分布', 'Knowledge Object Distribution'],
  'ws.overview.note': ['概念映射与时间线视图将在 P2 阶段提供；当前版本的证据与审核数据可在对应子页查看。', 'Concept map and timeline views are planned for Phase 2. Evidence and review data are available in their sub-tabs.'],
  // 通用
  'ws.loadFailed': ['加载失败：{error}', 'Failed to load: {error}'],
  'ws.actionFailed': ['操作失败：{error}', 'Action failed: {error}'],
  // 原文与分段
  'ws.source.empty': ['该案例尚未导入原文分段。可在「AI 抽取」流程中解析文本，或等待案例库批量导入。', 'No source segments imported for this case yet. Parse the text in the AI extraction flow, or wait for the Case Library batch import.'],
  'ws.source.searchPlaceholder': ['在分段中搜索…', 'Search segments...'],
  'ws.source.count': ['{filtered} / {total} 段', '{filtered} / {total} segments'],
  // 证据
  'ws.evidence.listHead': ['实体（按证据数排序）', 'Entities (sorted by evidence count)'],
  'ws.evidence.hint': ['点击左侧实体查看其证据链（逐字引文 + 文档定位）。', 'Click an entity on the left to view its evidence chain (verbatim quotes + document location).'],
  'ws.evidence.none': ['该实体暂无证据记录。导入案例的实体均应有证据；若缺失请在审核页拒绝或补充。', 'No evidence recorded for this entity. Entities from imported cases should all have evidence; if missing, reject it on the Review tab or add evidence.'],
  'ws.evidence.manual': ['人工导入', 'Manual import'],
  'ws.evidence.legacy': ['存量', 'Legacy'],
  'ws.evidence.ai': ['AI抽取', 'AI extracted'],
  'ws.evidence.quote': ['「{quote}」', '\u201C{quote}\u201D'],
  'ws.evidence.segment': ['段落 #{index}', 'Segment #{index}'],
  'ws.evidence.pageSuffix': [' · 第 {page} 页', ' · page {page}'],
  // 审核
  'ws.review.approve': ['通过', 'Approve'],
  'ws.review.edit': ['编辑', 'Edit'],
  'ws.review.reject': ['拒绝', 'Reject'],
  'ws.review.restore': ['恢复', 'Restore'],
  'ws.review.entityPending': ['实体待审 {count}', '{count} entities pending'],
  'ws.review.entityConfirmed': ['实体已确认 {count}', '{count} entities confirmed'],
  'ws.review.entityRejected': ['实体已拒绝 {count}', '{count} entities rejected'],
  'ws.review.relationPending': ['关系待审 {count}', '{count} relations pending'],
  'ws.review.relationConfirmed': ['关系已确认 {count}', '{count} relations confirmed'],
  'ws.review.relationRejected': ['关系已拒绝 {count}', '{count} relations rejected'],
  'ws.review.editEntity': ['编辑实体名称/类型：', 'Edit entity name/type:'],
  'ws.review.editRelation': ['编辑关系名称/类型：', 'Edit relation name/type:'],
  'ws.review.reasonPlaceholder': ['审核原因（可选，记入审核日志）', 'Review reason (optional, saved to the review log)'],
  'ws.review.entitySection': ['实体审核', 'Entity Review'],
  'ws.review.relationSection': ['关系审核', 'Relation Review'],
  'ws.review.factsSection': ['原子事实（L1）', 'Atomic Facts (L1)'],
  'ws.review.sources': ['来源：{refs}', 'Sources: {refs}'],
  'ws.review.noFacts': ['暂无原子事实。', 'No atomic facts.'],
  // ==== ErrorBoundary.jsx ====
  'error.boundary.title': ['出现了一些问题', 'Something went wrong'],
  'error.boundary.desc': ['页面遇到了意外错误，请尝试刷新页面。如果问题持续存在，请联系技术支持。', 'The page ran into an unexpected error. Try reloading the page. If the problem persists, please contact technical support.'],
  'error.boundary.reload': ['重新加载', 'Reload'],
  'error.boundary.details': ['错误详情', 'Error details'],
  // ==== ClassicCaseFlow.jsx ====
  'classic.back': ['返回新版', 'Back to new version'],
  'classic.backTitle': ['返回 CaseFlow 2.0 工作台', 'Back to CaseFlow 2.0 workspace'],
  // ==== caseHelpers.js（formatRelativeDate / formatCaseDate 等）====
  'time.yearsAgo': ['{count}年前', '{count}y ago'],
  'time.monthsAgo': ['{count}个月前', '{count}mo ago'],
  'time.fullDate': ['{y}年{m}月{d}日', '{m}/{d}/{y}'],
  // ==== caseHelpers.js（validateCaseForm，经内部 tr() 直接输出译文）====
  'validation.caseNameRequired': ['请输入案例名称', 'Please enter a case name'],
  'validation.yearInvalid': ['年份格式不正确，请输入4位数字', 'Invalid year format, please enter 4 digits'],
  'validation.caseNameTooLong': ['案例名称不能超过100个字符', 'Case name cannot exceed 100 characters'],
  'validation.caseDescTooLong': ['案例描述不能超过2000个字符', 'Case description cannot exceed 2000 characters'],
};
