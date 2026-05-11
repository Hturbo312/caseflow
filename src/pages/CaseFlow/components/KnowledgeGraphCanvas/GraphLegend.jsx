import React from 'react';

const GraphLegend = ({ entityTypes }) => {
  return (
    <div
      className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-white rounded-lg shadow-md border border-gray-200 p-2 sm:p-3"
      role="region"
      aria-label="图谱图例"
    >
      <h4 className="text-xs font-semibold text-gray-500 mb-2">图例</h4>
      <div className="space-y-1.5">
        {entityTypes?.map(type => (
          <div key={type.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: type.color }}
            />
            <span className="text-xs text-gray-600">{type.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GraphLegend;