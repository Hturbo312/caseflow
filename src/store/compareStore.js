import { create } from 'zustand';

/**
 * 跨案例对比选择集（全局）
 * 案例列表的对比托盘与主区对比面板共用同一数据源，双向同步
 */
export const useCompareStore = create((set, get) => ({
  ids: [],      // 选入对比的案例 id（字符串）
  MAX: 4,       // 与 /api/compare 上限一致

  toggle: (id) => {
    const key = String(id);
    const { ids, MAX } = get();
    if (ids.includes(key)) {
      set({ ids: ids.filter((x) => x !== key) });
    } else if (ids.length < MAX) {
      set({ ids: [...ids, key] });
    }
    // 达到上限后忽略新选择，托盘计数 "n/4" 即提示
  },
  remove: (id) => set((state) => ({ ids: state.ids.filter((x) => x !== String(id)) })),
  clear: () => set({ ids: [] }),
}));
