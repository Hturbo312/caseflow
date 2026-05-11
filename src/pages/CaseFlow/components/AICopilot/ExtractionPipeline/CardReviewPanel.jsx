import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, CheckCheck, XCircle } from 'lucide-react';
import EntityCard from './EntityCard';

const CardReviewPanel = memo(({ entityType, cards, currentSchema, onUpdateStatus, onBatchUpdate }) => {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filter, setFilter] = useState('all'); // all | pending | approved | skipped

  const entityDef = currentSchema?.entityTypes?.find(e => e.name === entityType);
  const color = entityDef?.color || '#3b82f6';

  const filteredCards = cards.filter(c => filter === 'all' || c.status === filter);
  const stats = {
    total: cards.length,
    pending: cards.filter(c => c.status === 'pending').length,
    approved: cards.filter(c => c.status === 'approved').length,
    skipped: cards.filter(c => c.status === 'skipped').length,
  };

  const handleSelectAll = () => {
    const pendingIds = cards.filter(c => c.status === 'pending').map(c => c.id);
    setSelectedIds(prev =>
      pendingIds.every(id => prev.has(id)) ? new Set() : new Set(pendingIds)
    );
  };

  const handleBatchApprove = () => {
    if (selectedIds.size === 0) return;
    onBatchUpdate(Array.from(selectedIds), 'approved');
    setSelectedIds(new Set());
  };

  const handleBatchSkip = () => {
    if (selectedIds.size === 0) return;
    onBatchUpdate(Array.from(selectedIds), 'skipped');
    setSelectedIds(new Set());
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-semibold text-gray-900">{entityType}</span>
          <div className="flex gap-3 text-xs text-gray-500">
            <span>共 {stats.total} 个</span>
            <span className="text-green-600">已确认 {stats.approved}</span>
            <span className="text-gray-400">已跳过 {stats.skipped}</span>
            {stats.pending > 0 && <span className="text-amber-600">待审核 {stats.pending}</span>}
          </div>
        </div>

        {/* 筛选 */}
        <div className="flex gap-1">
          {['all', 'pending', 'approved', 'skipped'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filter === f ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {f === 'all' ? '全部' : f === 'pending' ? '待审' : f === 'approved' ? '已确认' : '已跳过'}
            </button>
          ))}
        </div>
      </div>

      {/* 批量操作 */}
      {stats.pending > 0 && (
        <div className="flex items-center gap-2 px-1">
          <button
            onClick={handleSelectAll}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <CheckCheck size={14} />
            {selectedIds.size > 0 ? `已选 ${selectedIds.size} 个` : '全选待审'}
          </button>
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleBatchApprove}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <Check size={14} /> 确认选中
              </button>
              <button
                onClick={handleBatchSkip}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <XCircle size={14} /> 跳过选中
              </button>
            </>
          )}
          {selectedIds.size === 0 && (
            <>
              <button
                onClick={() => onBatchUpdate(cards.filter(c => c.status === 'pending').map(c => c.id), 'approved')}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <Check size={14} /> 全部确认
              </button>
              <button
                onClick={() => onBatchUpdate(cards.filter(c => c.status === 'pending').map(c => c.id), 'skipped')}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <XCircle size={14} /> 全部跳过
              </button>
            </>
          )}
        </div>
      )}

      {/* 卡片列表 */}
      <AnimatePresence>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {filteredCards.map(card => (
            <div key={card.id} className="relative">
              {selectedIds.has(card.id) && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-400 rounded-full" />
              )}
              <EntityCard
                card={card}
                entityType={entityType}
                color={color}
                onApprove={(id) => onUpdateStatus(id, 'approved')}
                onSkip={(id) => onUpdateStatus(id, 'skipped')}
              />
            </div>
          ))}
          {filteredCards.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-4">
              {filter === 'all' ? '暂无实体' : `没有${filter === 'pending' ? '待审' : filter === 'approved' ? '已确认' : '已跳过'}的实体`}
            </p>
          )}
        </div>
      </AnimatePresence>
    </div>
  );
});

CardReviewPanel.displayName = 'CardReviewPanel';

export default CardReviewPanel;
