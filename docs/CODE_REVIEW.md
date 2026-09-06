# CaseFlow 代码 Review 报告（2026-09-06）

范围：`feat/caseflow-2.0` 分支全量（前端 src/ + 后端 server/）。
结论：本次清理 9 个死文件、归档 4 个遗留脚本、移除调试日志与无用导入、拆分 1730 行 store 巨石为 8 个模块；遗留债务按优先级登记如下，供后续迭代消化。

## 一、本次已处理

### 死代码删除（确认零引用后删除）
- `src/pages/CaseFlow/components/CommandPalette.jsx`（Ctrl K 移除后遗留）
- `src/pages/CaseFlow/components/Workspace/WorkflowNav.jsx`（CaseFlowV2 中 `{false && …}` 死渲染）
- `src/pages/CaseFlow/components/Workspace/CaseWorkspace.jsx`（已被 ResearchCase 替代，无引用）
- `src/components/GraphBackground.jsx`、`NavPanel.jsx`、`MobileLayout.jsx`、`ParticleAvatar.jsx`、`CanvasViewport.jsx`、`CityGridBackground.jsx`（v1 首页遗留，Home 现自绘 three.js 场景）

### 调试残留与无用导入
- `services/api.js`：移除每次请求的 console.log 与认证失败日志
- `store` 登录成功 console.log 移除
- `server/routes/ai.js`：移除收紧后不再使用的 aiConfigCache/updateAiConfig/resetAiConfig/PORT 导入

### 遗留脚本归档
- `server/` 根目录的 `testFullPipeline.js`、`generateTestData.js`、`migrate_age.js`、`generate_embeddings.js` → `server/scripts/legacy/`

### 模块化：store 巨石拆分
`store/index.js`（1730 行）按职责拆为：
`authStore`(102) / `schemaStore`(399) / `caseStore`(214) / `graphStore`(249) / `aiStore`(15) / `agentStore`(373) / `extractionStore`(320) / `demoData`(82)；
`index.js` 仅保留 re-export（全部既有 `@store` 导入路径不变）。跨 store 引用一律走 action 内的 `getState()` 延迟调用，规避 ESM 循环依赖 TDZ。

## 二、遗留债务（按优先级）

### P1（影响安全/正确性）
1. `user_ai_configs.api_key` 仍明文入库（Spec 6.8 要求加密存储；当前仅返回掩码）。
2. `server/services/extractionPipeline.js`（1038 行）单文件承载 parse/plan/extract/review 全阶段，建议按阶段拆模块并补阶段级测试。

### P2（可维护性）
3. `KnowledgeGraphCanvas/index.jsx`（1075 行）：工具栏/图例/详情面板/路径分析可拆为子模块，画布逻辑独立。
4. `CaseExtractor/index.jsx`（1012 行）+ `DeepExtraction/`：v1 经典版专用，若确认弃用可整体归档。
5. i18n 双轨：`translations.js`（旧 1202 行）与 `translations.v2.js + dicts/` 并存，同名 key 旧文件会先加载被覆盖；应逐步把仍在使用的旧 key 迁入 dicts 后删除旧文件。
6. `CaseCard.css`（937 行）：v1 增强卡样式与 v2 覆盖修复混杂，建议按组件拆分并清理未用类。
7. `workspace.css`（816 行）与 `academic.css/design-system.css` 存在同名片断（如 `.v2-topbar`），依赖加载顺序与特异性，易踩覆盖坑；新样式一律进对应组件的独立 css。

### P3（增强）
8. 图表 SVG 内文本、KG 图例等深层文案尚未纳入双语字阶。
9. 后端各路由重复 try/catch：建议统一 error-handling 中间件 + asyncHandler 包装。
10. 前端缺自动化测试：sourceLocator.test.js 已开先例，store 与 api 层建议补 vitest。

## 三、约定（新增代码必须遵守）
1. 界面文案禁止硬编码中文：一律写进 `src/i18n/dicts/*.js` 成对词条并 `t()` 引用。
2. 样式禁止在 workspace.css 与 design-system.css 之间靠加载顺序覆盖：新组件样式放独立文件，确需覆盖用提高特异性的选择器。
3. store 只允许 `@store` 入口导入；跨 store 调用放在 action 内用 `getState()`。
4. 删除文件前先全库 grep 确认零引用（含 i18n dicts 文案引用）。
