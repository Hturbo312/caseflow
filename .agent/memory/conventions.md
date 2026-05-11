# CaseFlow 开发惯例

<!-- updated: 2026-03-24 -->
<!-- confidence: high -->
<!-- source: code_reading -->

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `CaseDetail.jsx` |
| Store hooks | camelCase + use前缀 | `useCaseStore` |
| CSS类 | kebab-case + 前缀 | `caseflow-card` |
| API函数 | camelCase | `loadCases`, `addEntity` |

## 文件组织

- 组件放在 `src/components/`
- 页面放在 `src/pages/`
- 状态管理放在 `src/store/index.js` (单文件多store)
- 样式与组件同级或放在 `pages/*.css`

## 状态管理模式

```javascript
// Zustand store 结构
export const useXxxStore = create((set, get) => ({
  // 数据
  items: [],
  currentId: null,
  isLoading: false,

  // 同步方法
  setItems: (items) => set({ items }),

  // 异步方法 (API)
  loadItems: async () => {
    set({ isLoading: true });
    const data = await api.getItems();
    set({ items: data, isLoading: false });
  },

  // 获取器
  getCurrent: () => get().items.find(i => i.id === get().currentId),
}));
```

## CSS 设计系统

- 使用 CSS 变量 (`--color-primary`, `--space-4`)
- Apple 风格设计语言
- 响应式断点: 1200px, 900px
- 最小点击区域 44x44px