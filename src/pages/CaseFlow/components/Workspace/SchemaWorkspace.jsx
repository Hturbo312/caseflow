import { useState } from 'react';
import { Database, ChevronDown, ChevronRight } from 'lucide-react';
import SchemaArchitect from '../SchemaArchitect';
import VersionBar from './VersionBar';
import { useI18n } from '../../../../i18n';

/**
 * Dynamic Schema 工作区（Spec §3.2）
 * 版本栏：families/versions、创建草案、差异、影响分析、批准/冻结/归档
 * 下方承载 SchemaArchitect（类型 / 关系 / 概念管理 + AI 建议）
 * 版本管理属高级功能，默认折叠，展开时才渲染 VersionBar
 */
export default function SchemaWorkspace({ isAuthenticated, onShowLogin }) {
  const { t } = useI18n();
  const [advOpen, setAdvOpen] = useState(false);
  return (
    <div className="ws-schema">
      <div className="ws-schema-banner">
        <Database size={14} />
        <div>
          <b>{t('v2.schema.bannerTitle')}</b>
          <span>{t('v2.schema.bannerDesc')}</span>
        </div>
      </div>
      <div className="ws-schema-versions">
        {/* 低调的小按钮：配色跟随 ws-schema-banner（浅青底 / 青字） */}
        <button
          type="button"
          onClick={() => setAdvOpen((v) => !v)}
          title={t('ux.schema.advToggle')}
          aria-expanded={advOpen}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            border: '1px solid #a5f3fc', background: '#ecfeff', color: '#0e7490',
            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
            fontSize: 11.5, fontWeight: 600,
          }}
        >
          {advOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {t('ux.schema.advTitle')}
        </button>
        {advOpen && (
          <div style={{ marginTop: 8 }}>
            <VersionBar />
          </div>
        )}
      </div>
      <div className="ws-schema-body">
        <SchemaArchitect isAuthenticated={isAuthenticated} onShowLogin={onShowLogin} />
      </div>
    </div>
  );
}
