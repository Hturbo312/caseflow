import React, { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Focus, Trash2, ChevronDown, ChevronUp, Building, Link2, Hash, Activity, MapPin, Calendar, FileText, Settings } from 'lucide-react';
import { useI18n } from '../../../../i18n';
import { calculateTopologyMetrics } from './utils';

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
  onDelete
}) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const entityCount = caseItem.entities?.length || 0;
  const relationCount = caseItem.relations?.length || 0;

  // 默认配置
  const config = cardConfig || {
    showSummary: true,
    showMetrics: true,
    showEntities: true,
    showTags: true,
    customFields: []
  };

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

  // 获取核心实体
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

  // 语义标签
  const semanticTags = useMemo(() => {
    const tags = [...(caseItem.tags || [])];
    const tagTypes = entityTypes.filter(t => t.showAsTag).map(t => t.name);

    const entityTags = [];
    caseItem.entities?.forEach(entity => {
      const type = entity.entityType;
      if (tagTypes.includes(type) || entityTypeConfig.get(type)?.showAsTag) {
        if (!entityTags.includes(type)) entityTags.push(type);
      }
    });

    if (entityTags.length === 0) {
      const typeTags = [...new Set(caseItem.entities?.map(e => e.entityType) || [])].slice(0, 3);
      return [...tags, ...typeTags].slice(0, 5);
    }
    return [...tags, ...entityTags].slice(0, 5);
  }, [caseItem.tags, caseItem.entities, entityTypes, entityTypeConfig]);

  // 生成逻辑摘要
  const summary = useMemo(() => {
    if (caseItem.description) {
      return caseItem.description.length > 60
        ? caseItem.description.substring(0, 60) + '...'
        : caseItem.description;
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

  const handleClick = () => {
    if (!expanded) setExpanded(true);
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
    onDelete(caseItem, e);
  };

  return (
    <motion.div
      onClick={handleClick}
      className={`caseflow-card-enhanced ${isSelected ? 'selected' : ''} ${expanded ? 'expanded' : ''}`}
      initial={false}
      animate={{ height: expanded ? 'auto' : 'auto' }}
    >
      <div className="caseflow-card-main">
        <div className="caseflow-card-header">
          <div className="caseflow-card-title-row">
            <h3 className="caseflow-card-title">{caseItem.name}</h3>
            <div className="caseflow-card-actions">
              {isSelected && (
                <button onClick={handleDeselectClick} className="caseflow-card-action-btn" title={t('case.backGlobal')}>
                  <Focus size={14} />
                </button>
              )}
              <button onClick={handleDeleteClick} className="caseflow-card-action-btn caseflow-card-delete" title={t('delete.entity.title')}>
                <Trash2 size={14} />
              </button>
              <button onClick={handleToggleExpand} className="caseflow-card-action-btn" title={expanded ? t('case.collapse') : t('case.info')}>
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
          <div className="caseflow-card-badges">
            <span className="caseflow-card-badge">{schemaName}</span>
          </div>
        </div>

        {/* 逻辑摘要 */}
        {config.showSummary && (
          <div className="caseflow-card-summary">
            <FileText size={12} className="caseflow-card-summary-icon flex-shrink-0" />
            <p className="caseflow-card-summary-text">{summary}</p>
          </div>
        )}

        {/* 核心实体 */}
        {config.showEntities && coreEntities.length > 0 && (
          <div className="caseflow-card-entities">
            <span className="caseflow-card-section-label">
              <Building size={10} /> {t('case.coreEntities')}
            </span>
            <div className="caseflow-card-entity-list">
              {coreEntities.map((entity, index) => (
                <div key={index} className="caseflow-card-entity-item">
                  <div className="caseflow-card-entity-dot" style={{ backgroundColor: entity.color }} />
                  <span className="caseflow-card-entity-name">{entity.name}</span>
                  {entity.count > 1 && <span className="caseflow-card-entity-count">+{entity.count - 1}</span>}
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
                <div className="caseflow-card-metric-density" style={{ '--density': topologyMetrics.completeness + '%' }}>
                  <div className="caseflow-card-metric-density-fill" />
                </div>
                <span className="caseflow-card-metric-label hidden sm:inline">{t('case.completeness')}</span>
                <span className="caseflow-card-metric-label sm:hidden">完整</span>
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

        {/* 语义标签 */}
        {config.showTags && semanticTags.length > 0 && (
          <div className="caseflow-card-tags">
            <span className="caseflow-card-section-label">
              <Hash size={10} /> {t('case.semanticTags')}
            </span>
            <div className="caseflow-card-tag-list">
              {semanticTags.map((tag, index) => (
                <span key={index} className="caseflow-card-tag">{tag}</span>
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

      {/* 展开详情面板 */}
      <AnimatePresence>
        {expanded && (
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
                  {caseItem.relations.slice(0, 6).map((rel, index) => {
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
                  {caseItem.relations.length > 6 && (
                    <span className="caseflow-card-detail-more">{t('case.moreRelations', { count: caseItem.relations.length - 6 })}</span>
                  )}
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