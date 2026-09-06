import React, { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Focus, Trash2, ChevronDown, ChevronUp, Building, Link2, Activity, MapPin, Calendar, FileText, Settings, Tag, Layers, GitCompare } from 'lucide-react';
import { useI18n } from '../../../../i18n';
import { calculateTopologyMetrics, getCaseStatus } from './utils';

/**
 * 预设函数实现
 */
const presetFunctions = {
  entityCount: (caseItem) => caseItem.entities?.length || 0,
  relationCount: (caseItem) => caseItem.relations?.length || 0,
  avgDegree: (caseItem) => {
    const e = caseItem.entities?.length || 0;
    const r = caseItem.relations?.length || 0;
    return calculateTopologyMetrics(e, r).avgDegree;
  },
  density: (caseItem) => {
    const e = caseItem.entities?.length || 0;
    const r = caseItem.relations?.length || 0;
    return calculateTopologyMetrics(e, r).density;
  },
  completeness: (caseItem) => {
    const e = caseItem.entities?.length || 0;
    const r = caseItem.relations?.length || 0;
    return calculateTopologyMetrics(e, r).completeness;
  },
  entityTypes: (caseItem) => {
    const types = new Set(caseItem.entities?.map(e => e.entityType) || []);
    return types.size;
  },
  coreEntities: (caseItem, entityTypeConfig) => {
    const coreTypes = [];
    const typeMap = new Map();
    caseItem.entities?.forEach(entity => {
      const type = entity.entityType;
      if (!typeMap.has(type)) typeMap.set(type, []);
      typeMap.get(type).push(entity);
    });
    typeMap.forEach((entities, type) => {
      const config = entityTypeConfig.get(type);
      if (config?.isCore && entities.length > 0) {
        coreTypes.push(entities[0].name);
      }
    });
    return coreTypes.slice(0, 3).join('、') || '-';
  },
  year: (caseItem) => caseItem.year || '-',
  location: (caseItem) => caseItem.location || '-'
};

/**
 * CaseCard - 增强版案例卡片组件
 * 展示核心实体、逻辑摘要、拓扑指标和语义标签
 * 根据 Schema 中定义的 cardConfig 动态渲染
 */
const CaseCard = memo(({
  caseItem,
  isSelected,
  schemaName,
  focusMode,
  entityTypes = [],
  cardConfig,
  onSelect,
  onDeselect,
  onDelete,
  onPreview,
  isAuthenticated = true,
  onShowLogin,
  compareMode = false,
  compareSelected = false,
  onToggleCompare,
  compact = false
}) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const entityCount = caseItem.entities?.length || 0;
  const relationCount = caseItem.relations?.length || 0;

  // 默认配置；compact 模式只保留标题 + 单行元信息（Spec §5.3：卡片不塞长段落，详情在中栏）
  const config = compact ? {
    showSummary: false,
    showMetrics: false,
    showEntities: false,
    showTags: false,
    customFields: []
  } : (cardConfig || {
    showSummary: true,
    showMetrics: true,
    showEntities: true,
    showTags: true,
    customFields: []
  });

  // 案例状态
  const caseStatus = useMemo(() => getCaseStatus(caseItem), [caseItem]);

  // 构建 entityType 配置映射
  const entityTypeConfig = useMemo(() => {
    const map = new Map();
    entityTypes.forEach(type => {
      map.set(type.name, {
        color: type.color,
        isCore: type.isCore || false,
        showAsTag: type.showAsTag || false
      });
    });
    return map;
  }, [entityTypes]);

  // 实体类型分布统计
  const entityTypeDistribution = useMemo(() => {
    if (!caseItem.entities || caseItem.entities.length === 0) return [];

    const typeMap = new Map();
    caseItem.entities.forEach(entity => {
      const type = entity.entityType || '其他';
      if (!typeMap.has(type)) typeMap.set(type, { count: 0, color: null });
      const entry = typeMap.get(type);
      entry.count++;
      if (!entry.color) {
        const config = entityTypeConfig.get(type);
        entry.color = config?.color || entity.color || '#6366f1';
      }
    });

    const coreTypes = entityTypes.filter(t => t.isCore).map(t => t.name);
    return [...typeMap.entries()]
      .sort(([a], [b]) => {
        const aIsCore = coreTypes.includes(a) ? 0 : 1;
        const bIsCore = coreTypes.includes(b) ? 0 : 1;
        if (aIsCore !== bIsCore) return aIsCore - bIsCore;
        return typeMap.get(b).count - typeMap.get(a).count;
      })
      .map(([name, info]) => ({ name, ...info }));
  }, [caseItem.entities, entityTypes, entityTypeConfig]);

  // 获取核心实体（代表性实体名称）
  const coreEntities = useMemo(() => {
    if (!caseItem.entities || caseItem.entities.length === 0) return [];

    const typeMap = new Map();
    caseItem.entities.forEach(entity => {
      const type = entity.entityType || '其他';
      if (!typeMap.has(type)) typeMap.set(type, []);
      typeMap.get(type).push(entity);
    });

    const coreTypes = entityTypes.filter(t => t.isCore).map(t => t.name);
    const sortedTypes = [...typeMap.keys()].sort((a, b) => {
      const aIsCore = coreTypes.includes(a) ? 0 : 1;
      const bIsCore = coreTypes.includes(b) ? 0 : 1;
      return aIsCore - bIsCore;
    });

    const representatives = [];
    sortedTypes.forEach(type => {
      const entities = typeMap.get(type);
      const config = entityTypeConfig.get(type);
      representatives.push({
        ...entities[0],
        entityType: type,
        count: entities.length,
        color: config?.color || '#6366f1',
        isCore: config?.isCore || false
      });
    });

    return representatives.slice(0, 4);
  }, [caseItem.entities, entityTypes, entityTypeConfig]);

  // 计算拓扑指标
  const topologyMetrics = useMemo(() => {
    return calculateTopologyMetrics(entityCount, relationCount);
  }, [entityCount, relationCount]);

  // Tags 数组
  const tags = useMemo(() => {
    if (!caseItem.tags) return [];
    if (Array.isArray(caseItem.tags)) return caseItem.tags;
    if (typeof caseItem.tags === 'string') {
      try { return JSON.parse(caseItem.tags); } catch { return [caseItem.tags]; }
    }
    return [];
  }, [caseItem.tags]);

  // 生成逻辑摘要
  const summary = useMemo(() => {
    if (caseItem.description) {
      return caseItem.description;
    }
    if (coreEntities.length > 0) {
      const names = coreEntities.slice(0, 3).map(e => e.name).join('、');
      return t('case.summaryFallback', { count: names });
    }
    return t('case.noSummary');
  }, [caseItem.description, coreEntities, t]);

  // 计算自定义字段值
  const customFieldValues = useMemo(() => {
    const values = {};
    (config.customFields || []).forEach(field => {
      if (field.type === 'preset' && presetFunctions[field.function]) {
        values[field.id] = presetFunctions[field.function](caseItem, entityTypeConfig);
      } else if (field.type === 'custom') {
        // 自定义字段从实体属性中获取
        if (field.source === 'entity') {
          const entity = caseItem.entities?.find(e => e.entityType === field.entityType);
          values[field.id] = entity?.properties?.[field.property] || '-';
        } else if (field.source === 'case') {
          values[field.id] = caseItem[field.property] || '-';
        }
      }
    });
    return values;
  }, [config.customFields, caseItem, entityTypeConfig]);

  // 点击分级：单击 → 预览（若支持预览则不抢占中栏），否则维持原选中；双击 → 正式在中栏打开
  const handleClick = () => {
    if (!compact && !expanded) setExpanded(true);
    if (onPreview) {
      onPreview(caseItem);
    } else {
      onSelect(caseItem);
    }
  };

  const handleDoubleClick = () => {
    onSelect(caseItem);
  };

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleDeselectClick = (e) => {
    e.stopPropagation();
    onDeselect();
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    // 访客删除保护：未登录时弹登录而不是执行删除
    if (!isAuthenticated) {
      onShowLogin?.();
      return;
    }
    onDelete(caseItem, e);
  };

  const handleCompareClick = (e) => {
    e.stopPropagation();
    onToggleCompare?.(caseItem);
  };

  return (
    <motion.div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`caseflow-card-enhanced ${compact ? 'compact' : ''} ${isSelected ? 'selected' : ''} ${expanded ? 'expanded' : ''} ${compareSelected ? 'compare-selected' : ''}`}
      initial={false}
      animate={{ height: expanded ? 'auto' : 'auto' }}
    >
      <div className="caseflow-card-main">
        <div className="caseflow-card-header">
          <div className="caseflow-card-title-row">
            <div className="caseflow-card-title-group">
              {compareMode && (
                <button
                  onClick={handleCompareClick}
                  className={`caseflow-card-compare-check ${compareSelected ? 'on' : ''}`}
                  title={compareSelected ? t('compare.mode.exit') : t('compare.mode.enter')}
                >
                  <GitCompare size={11} />
                </button>
              )}
              <span className={`caseflow-status-dot ${caseStatus}`} title={caseStatus} />
              <h3 className="caseflow-card-title" title={caseItem.name}>{caseItem.name}</h3>
              {!isAuthenticated && (
                <span className="v2-demo-badge">{t('ux.import.badge')}</span>
              )}
            </div>
            <div className="caseflow-card-actions">
              {isSelected && (
                <button onClick={handleDeselectClick} className="caseflow-card-action-btn" title={t('case.backGlobal')}>
                  <Focus size={14} />
                </button>
              )}
              <button onClick={handleDeleteClick} className="caseflow-card-action-btn caseflow-card-delete" title={t('delete.entity.title')}>
                <Trash2 size={14} />
              </button>
              {!compact && (
                <button onClick={handleToggleExpand} className="caseflow-card-action-btn" title={expanded ? t('case.collapse') : t('case.info')}>
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
            </div>
          </div>
          <div className="caseflow-card-badges">
            {compact ? (
              <>
                {caseItem.metadata?.case_code && (
                  <span className="caseflow-card-badge">{caseItem.metadata.case_code}</span>
                )}
                {(caseItem.location || caseItem.year) && (
                  <span className="caseflow-card-location">
                    <MapPin size={10} />
                    {caseItem.location}{caseItem.year ? ` · ${caseItem.year}` : ''}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="caseflow-card-badge">{schemaName}</span>
                {(caseItem.location || caseItem.year) && (
                  <span className="caseflow-card-location">
                    <MapPin size={10} />
                    {caseItem.location}{caseItem.year ? ` · ${caseItem.year}` : ''}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* 标签 */}
        {config.showTags && tags.length > 0 && (
          <div className="caseflow-card-tags">
            {tags.slice(0, 5).map((tag, i) => (
              <span key={i} className="caseflow-card-tag">{tag}</span>
            ))}
            {tags.length > 5 && (
              <span className="caseflow-card-tag-more">+{tags.length - 5}</span>
            )}
          </div>
        )}

        {/* 逻辑摘要 */}
        {config.showSummary && (
          <div className="caseflow-card-summary">
            <FileText size={12} className="caseflow-card-summary-icon flex-shrink-0" />
            <p className="caseflow-card-summary-text">{summary}</p>
          </div>
        )}

        {/* 实体类型分布 */}
        {config.showEntities && entityTypeDistribution.length > 0 && (
          <div className="caseflow-card-entities">
            <span className="caseflow-card-section-label">
              <Layers size={10} /> {t('case.entityTypes')}
            </span>
            <div className="caseflow-card-entity-list">
              {entityTypeDistribution.map((typeInfo, index) => (
                <div key={index} className="caseflow-card-type-badge">
                  <div className="caseflow-card-entity-dot" style={{ backgroundColor: typeInfo.color }} />
                  <span className="caseflow-card-type-name">{typeInfo.name}</span>
                  <span className="caseflow-card-type-count">{typeInfo.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 拓扑指标 */}
        {config.showMetrics && (
          <div className="caseflow-card-metrics">
            <span className="caseflow-card-section-label">
              <Activity size={10} /> {t('case.metrics')}
            </span>
            <div className="caseflow-card-metric-list">
              <div className="caseflow-card-metric-item">
                <Building size={12} />
                <span className="caseflow-card-metric-value">{entityCount}</span>
                <span className="caseflow-card-metric-label hidden sm:inline">{t('case.entityCount')}</span>
                <span className="caseflow-card-metric-label sm:hidden">实体</span>
              </div>
              <div className="caseflow-card-metric-item">
                <Link2 size={12} />
                <span className="caseflow-card-metric-value">{relationCount}</span>
                <span className="caseflow-card-metric-label hidden sm:inline">{t('case.linkCount')}</span>
                <span className="caseflow-card-metric-label sm:hidden">关系</span>
              </div>
              <div className="caseflow-card-metric-item">
                <Activity size={12} />
                <span className="caseflow-card-metric-value">{topologyMetrics.avgDegree}</span>
                <span className="caseflow-card-metric-label hidden sm:inline">{t('case.avgDegree')}</span>
                <span className="caseflow-card-metric-label sm:hidden">度</span>
              </div>
              <div className="caseflow-card-metric-item">
                <Layers size={12} />
                <span className="caseflow-card-metric-value">{entityTypeDistribution.length}</span>
                <span className="caseflow-card-metric-label hidden sm:inline">{t('case.entityTypes')}</span>
                <span className="caseflow-card-metric-label sm:hidden">类型</span>
              </div>
            </div>
          </div>
        )}

        {/* 自定义字段 */}
        {(config.customFields || []).length > 0 && (
          <div className="caseflow-card-custom-fields">
            <span className="caseflow-card-section-label">
              <Settings size={10} /> {t('case.custom')}
            </span>
            <div className="caseflow-card-custom-list">
              {config.customFields.map(field => (
                <div key={field.id} className="caseflow-card-custom-item">
                  <span className="caseflow-card-custom-label">{field.name}</span>
                  <span className="caseflow-card-custom-value">{customFieldValues[field.id]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isSelected && focusMode === 'case' && (
          <div className="caseflow-card-focus-indicator">
            <Focus size={12} />
            <span>{t('case.focusing')}</span>
          </div>
        )}
      </div>

      {/* 展开详情面板（compact 模式无展开；详情在中栏 Case 工作区） */}
      <AnimatePresence>
        {expanded && !compact && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="caseflow-card-detail"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="caseflow-card-detail-section">
              <h4 className="caseflow-card-detail-title">{t('case.info')}</h4>
              <div className="caseflow-card-detail-grid">
                {caseItem.location && (
                  <div className="caseflow-card-detail-item">
                    <MapPin size={14} />
                    <span>{caseItem.location}</span>
                  </div>
                )}
                {caseItem.year && (
                  <div className="caseflow-card-detail-item">
                    <Calendar size={14} />
                    <span>{caseItem.year}{t('case.yearSuffix')}</span>
                  </div>
                )}
              </div>
              {caseItem.description && (
                <p className="caseflow-card-detail-desc">{caseItem.description}</p>
              )}
            </div>

            {caseItem.entities && caseItem.entities.length > 0 && (
              <div className="caseflow-card-detail-section">
                <h4 className="caseflow-card-detail-title">
                  <Building size={14} />
                  {t('case.allEntities')} ({entityCount})
                </h4>
                <div className="caseflow-card-detail-entities">
                  {caseItem.entities.map((entity, index) => {
                    const config = entityTypeConfig.get(entity.entityType);
                    return (
                      <div key={index} className="caseflow-card-detail-entity">
                        <div className="caseflow-card-entity-dot" style={{ backgroundColor: config?.color || entity.color || '#6366f1' }} />
                        <span className="caseflow-card-entity-name">{entity.name}</span>
                        <span className="caseflow-card-entity-type">{entity.entityType}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {caseItem.relations && caseItem.relations.length > 0 && (
              <div className="caseflow-card-detail-section">
                <h4 className="caseflow-card-detail-title">
                  <Link2 size={14} />
                  {t('case.allLinks')} ({relationCount})
                </h4>
                <div className="caseflow-card-detail-relations">
                  {caseItem.relations.map((rel, index) => {
                    const source = caseItem.entities?.find(e => e.id === rel.sourceId || e.id === rel.source_id);
                    const target = caseItem.entities?.find(e => e.id === rel.targetId || e.id === rel.target_id);
                    return (
                      <div key={index} className="caseflow-card-detail-relation">
                        <span className="caseflow-card-relation-node">{source?.name || '?'}</span>
                        <span className="caseflow-card-relation-arrow">→</span>
                        <span className="caseflow-card-relation-name">{rel.name || rel.relation_type}</span>
                        <span className="caseflow-card-relation-arrow">→</span>
                        <span className="caseflow-card-relation-node">{target?.name || '?'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="caseflow-card-detail-actions">
              <button onClick={handleToggleExpand} className="caseflow-card-detail-btn">{t('case.collapse')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

CaseCard.displayName = 'CaseCard';

export default CaseCard;