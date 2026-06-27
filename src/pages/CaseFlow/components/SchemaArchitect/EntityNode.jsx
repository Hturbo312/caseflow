import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { useI18n } from '../../../../i18n';

/**
 * 自定义 Schema 实体节点（ReactFlow 节点）
 */
const EntityNode = ({ data }) => {
  const { t } = useI18n();
  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: '12px',
        background: 'white',
        border: `2.5px solid ${data.color}`,
        boxShadow: `0 4px 12px ${data.color}25`,
        minWidth: '120px',
        textAlign: 'center',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: data.color, width: 8, height: 8 }}
      />
      <div style={{ fontWeight: 600, color: data.color, fontSize: 14 }}>
        {data.label}
      </div>
      {data.propertyCount > 0 && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          {data.propertyCount} {t('schema.properties')}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
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
