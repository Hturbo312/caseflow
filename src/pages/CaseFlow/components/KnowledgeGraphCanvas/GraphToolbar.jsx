import React, { useState, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Filter,
  Share2,
  Search,
  X,
  Route,
  Plus,
  Link2,
  AlertTriangle,
  ChevronDown,
  Layers
} from 'lucide-react';
import { useI18n } from '../../../../i18n';

const primaryColor = 'var(--color-primary, #a855f7)';

const GraphToolbar = ({
  // Search
  searchQuery,
  onSearchChange,
  searchResults,
  onSearchExecute,
  selectedSearchNode,
  onSelectSearchNode,
  searchDepth,
  onSearchDepthChange,
  showSearchResults,
  onToggleSearchResults,
  // Filters
  showFilters,
  onToggleFilters,
  filter,
  onFilterChange,
  entityTypes,
  // Zoom
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onFitToCanvas,
  // Path analysis
  showPathAnalysis,
  onTogglePathAnalysis,
  // Entity creation
  onEntityButtonClick,
  // Relation creation
  relationMode,
  onRelationButtonClick,
  // Case
  currentCaseId,
  // No case alert
  showNoCaseAlert,
  onDismissNoCaseAlert,
}) => {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();
  const searchInputRef = useRef(null);
  const [showDepthDropdown, setShowDepthDropdown] = useState(false);

  const DEPTH_OPTIONS = [
    { value: 0, label: t('toolbar.neighbors0') },
    { value: 1, label: t('toolbar.neighbors1') },
    { value: 2, label: t('toolbar.neighbors2') },
    { value: 3, label: t('toolbar.neighbors3') },
    { value: 4, label: t('toolbar.neighbors4') },
  ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSearchResults || showDepthDropdown) {
        const target = e.target;
        if (!target.closest('.search-results-dropdown') && !target.closest('.depth-dropdown')) {
          onToggleSearchResults?.(false);
          setShowDepthDropdown(false);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSearchResults, showDepthDropdown, onToggleSearchResults]);

  // Handle search button click
  const handleSearchClick = () => {
    onSearchExecute?.();
  };

  // Handle Enter key in search input
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearchClick();
    }
  };

  return (
    <div className="border-b border-gray-200 px-3 py-2 flex-shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        {/* 左侧：标题 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
            <Share2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-900 hidden sm:inline">{t('toolbar.title')}</span>
        </div>

        <div className="flex-1" />

        {/* 中间：搜索框 */}
        <div className="relative order-last sm:order-none w-full sm:w-auto flex items-center gap-1">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('toolbar.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label={t('toolbar.search')}
              className="w-full sm:w-40 pl-7 pr-2.5 py-1.5 bg-gray-100 border border-transparent rounded-lg text-xs focus:bg-white focus:border-gray-300 focus:outline-none transition-all"
            />
            {/* 搜索按钮 */}
            <button
              type="button"
              onClick={handleSearchClick}
              disabled={!searchQuery.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500"
              title={t('toolbar.search')}
            >
              <Search className="w-3 h-3" />
            </button>
          </div>

          {/* 搜索结果数量提示 */}
          {searchResults.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => onToggleSearchResults?.(!showSearchResults)}
                className="h-8 px-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center gap-1"
              >
                <span>{searchResults.length} {t('toolbar.results')}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* 搜索结果下拉 */}
              {showSearchResults && (
                <div className="search-results-dropdown absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    {searchResults.map((node) => (
                      <button
                        type="button"
                        key={node.id}
                        onClick={() => onSelectSearchNode?.(node)}
                        className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-50 flex items-center gap-2 ${
                          selectedSearchNode?.id === node.id ? 'bg-purple-50 text-purple-700' : ''
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: node.color || '#9ca3af' }}
                        />
                        <span className="truncate">{node.name}</span>
                        <span className="text-gray-400 text-[10px] truncate">{node.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 深度选择（仅当选中搜索节点时显示） */}
          {selectedSearchNode && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDepthDropdown(!showDepthDropdown)}
                className="h-8 px-2 rounded-lg text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 flex items-center gap-1"
              title={t('toolbar.depth')}
              aria-label={t('toolbar.depth')}
              >
                <Layers className="w-3 h-3" />
                <span>{DEPTH_OPTIONS.find(d => d.value === searchDepth)?.label || t('toolbar.depth')}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* 深度下拉 */}
              {showDepthDropdown && (
                <div className="depth-dropdown absolute top-full left-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                  {DEPTH_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => {
                        onSearchDepthChange?.(option.value);
                        setShowDepthDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-50 ${
                        searchDepth === option.value ? 'bg-green-50 text-green-700' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 清除搜索 */}
          {(searchResults.length > 0 || selectedSearchNode) && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onSelectSearchNode?.(null);
                onToggleSearchResults?.(false);
              }}
              className="h-8 w-8 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center"
              title={t('toolbar.clearSearch')}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* 添加实体按钮 */}
          <button
            type="button"
            onClick={onEntityButtonClick}
            className="h-8 px-2.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 bg-blue-500 text-white hover:bg-blue-600"
            title={currentCaseId ? t('toolbar.addEntity') : t('toolbar.selectCaseFirst')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('toolbar.entity')}</span>
          </button>

          {/* 添加关系按钮 */}
          <button
            type="button"
            onClick={onRelationButtonClick}
            className={`h-8 px-2.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              relationMode
                ? 'text-white'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
            style={relationMode ? { backgroundColor: 'var(--color-success, #22c55e)' } : {}}
            title={currentCaseId ? t('toolbar.relationHint') : t('toolbar.selectCaseFirst')}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{relationMode ? t('common.cancel') : t('toolbar.relation')}</span>
          </button>

          {/* 路径分析按钮 */}
          <button
            type="button"
            onClick={onTogglePathAnalysis}
            className={`h-8 px-2.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showPathAnalysis
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={showPathAnalysis ? { backgroundColor: 'var(--color-success, #22c55e)' } : {}}
            title={t('toolbar.pathAnalysis')}
          >
            <Route className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{t('toolbar.path')}</span>
          </button>

          {/* 过滤按钮 */}
          <button
            type="button"
            onClick={onToggleFilters}
            aria-label={showFilters ? t('toolbar.closeFilter') : t('toolbar.openFilter')}
            aria-expanded={showFilters}
            className={`h-8 w-8 rounded-lg transition-colors flex items-center justify-center ${
              showFilters ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={t('toolbar.filter')}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>

          {/* 分隔线 */}
          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* 缩放控制 */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={onZoomOut}
              className="h-8 w-8 hover:bg-gray-50 transition-colors flex items-center justify-center"
              aria-label={t('toolbar.zoomOut')}
              title={t('toolbar.zoomOut')}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onFitToCanvas}
              className="h-8 px-2 hover:bg-gray-50 transition-colors border-l border-gray-200 flex items-center gap-1"
              aria-label={t('toolbar.fitCanvas')}
              title={t('toolbar.fitCanvas')}
            >
              <Maximize className="w-3.5 h-3.5" />
              <span className="text-[10px] text-gray-500 w-8 text-center">
                {zoomLevel && !isNaN(zoomLevel) ? `${Math.round(zoomLevel * 100)}%` : t('toolbar.fit')}
              </span>
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              className="h-8 w-8 hover:bg-gray-50 transition-colors border-l border-gray-200 flex items-center justify-center"
              aria-label={t('toolbar.zoomIn')}
              title={t('toolbar.zoomIn')}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 过滤面板 */}
      {showFilters && (
        <motion.div
          initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
          className="mt-2 p-2 bg-gray-50 rounded-lg overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-700">{t('toolbar.filters')}</h4>
            <button
              type="button"
              onClick={onToggleFilters}
              aria-label={t('toolbar.closeFilter')}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1.5">{t('toolbar.entityType')}</label>
              <div className="flex gap-1.5 flex-wrap">
                {entityTypes?.map(type => (
                  <button
                    type="button"
                    key={type.id}
                    onClick={() => {
                      const newTypes = filter.entityTypes.includes(type.name)
                        ? filter.entityTypes.filter(t => t !== type.name)
                        : [...filter.entityTypes, type.name];
                      onFilterChange({ entityTypes: newTypes });
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      filter.entityTypes.includes(type.name)
                        ? 'text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                    style={filter.entityTypes.includes(type.name) ? { backgroundColor: primaryColor, borderColor: 'transparent' } : { borderColor: type.color }}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 无案例提示 */}
      {showNoCaseAlert && (
        <motion.div
          initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
          className="mt-2 p-2 bg-amber-50 rounded-lg overflow-hidden border border-amber-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs text-amber-700">
                {t('toolbar.noCaseAlert')}
              </span>
            </div>
            <button
              type="button"
              onClick={onDismissNoCaseAlert}
              className="p-1 hover:bg-amber-200 rounded"
            >
              <X className="w-3 h-3 text-amber-600" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default GraphToolbar;