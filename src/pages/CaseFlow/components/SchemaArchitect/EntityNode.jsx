import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { useI18n } from '../../../../i18n';

/**
 * 自定义 Schema 实体节点（ReactFlow 节点）
 * 卡片视觉与案例研究关系图对齐：白卡 + 概念色顶条。
 * 悬停显示删除按钮（仅当 data.onDelete 注入时渲染，SchemaArchitect 用法不受影响）。
 * 注意：四个 Handle 的写法（id/position/style）逐字保留——连线锚点字符串与 Handle id 必须逐字对应。
 */
const EntityNode = ({ data }) => {
  const { t } = useI18n();
  return (
    <div
      className="fw-entity-card"
      style={{
        position: 'relative',
        padding: '8px 14px 9px',
        borderRadius: '8px',
        background: 'white',
        border: '1px solid #d7e0e8',
        borderTop: `3px solid ${data.color}`,
        boxShadow: '0 2px 6px rgba(31,56,88,0.08)',
        minWidth: '110px',
        maxWidth: '178px',
        textAlign: 'center',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ background: data.color, width: 8, height: 8 }}
      />
      {data.onDelete && (
        <button
          className="fw-node-del"
          title="删除此概念"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); data.onDelete(e); }}
        >×</button>
      )}
      <div style={{ fontWeight: 600, color: '#24435c', fontSize: 13, lineHeight: 1.35, wordBreak: 'break-word' }}>
        {data.label}
      </div>
      {data.propertyCount > 0 && (
        <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 3 }}>
          {data.propertyCount} {t('schema.properties')}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ background: data.color, width: 8, height: 8 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: data.color, width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: data.color, width: 8, height: 8 }}
      />
    </div>
  );
};

export default EntityNode;

export const nodeTypes = { entity: EntityNode };
