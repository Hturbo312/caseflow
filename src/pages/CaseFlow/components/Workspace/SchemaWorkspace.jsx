import { Database } from 'lucide-react';
import SchemaArchitect from '../SchemaArchitect';
import VersionBar from './VersionBar';

/**
 * Dynamic Schema 工作区（Spec §3.2）
 * 版本栏：families/versions、创建草案、差异、影响分析、批准/冻结/归档
 * 下方承载 SchemaArchitect（类型 / 关系 / 概念管理 + AI 建议）
 */
export default function SchemaWorkspace({ isAuthenticated, onShowLogin }) {
  return (
    <div className="ws-schema">
      <div className="ws-schema-banner">
        <Database size={14} />
        <div>
          <b>Dynamic Schema v1.0（论文研究配置）</b>
          <span>13 类知识对象 · 21 类关系 · 30 个共享概念 —— AI 建议需研究者批准后才生效</span>
        </div>
      </div>
      <div className="ws-schema-versions">
        <VersionBar />
      </div>
      <div className="ws-schema-body">
        <SchemaArchitect isAuthenticated={isAuthenticated} onShowLogin={onShowLogin} />
      </div>
    </div>
  );
}
