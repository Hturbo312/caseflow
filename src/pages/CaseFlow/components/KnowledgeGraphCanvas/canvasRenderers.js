/**
 * Canvas rendering functions for KnowledgeGraphCanvas
 * Extracted as pure functions for performance optimization
 * These functions are stable and won't cause unnecessary re-renders
 */

/**
 * Render a node on the canvas
 * @param {Object} params - Rendering parameters
 * @param {Object} params.node - Node to render
 * @param {CanvasRenderingContext2D} params.ctx - Canvas context
 * @param {number} params.globalScale - Current zoom scale
 * @param {Object|null} params.selectedNode - Currently selected node
 * @param {Object|null} params.pathStartNode - Path analysis start node
 * @param {Object|null} params.pathEndNode - Path analysis end node
 * @param {Object|null} params.relationSource - Relation creation source node
 * @param {Object|null} params.relationTarget - Relation creation target node
 * @param {Set} params.pathNodeIds - Set of node IDs in the current path
 * @param {Function} params.getNodeColor - Function to get node color
 * @param {Function} params.getNodeSize - Function to get node size
 */
export const renderNode = ({
  node,
  ctx,
  globalScale,
  selectedNode,
  pathStartNode,
  pathEndNode,
  relationSource,
  relationTarget,
  pathNodeIds,
  getNodeColor,
  getNodeSize,
}) => {
  // Skip invalid nodes (coordinates may be undefined during initialization)
  if (!node || typeof node.x === 'undefined' || typeof node.y === 'undefined') return;

  // Get node color and size
  const color = getNodeColor(node);
  const size = getNodeSize(node);

  // Calculate node radius (based on nodeVal)
  const radius = Math.sqrt(size) * 4;

  // Draw node circle
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  // Selected state border
  if (selectedNode?.id === node.id) {
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Highlight state border (path analysis/relation creation)
  if ((pathStartNode?.id === node.id) || (pathEndNode?.id === node.id) ||
      (relationSource?.id === node.id) || (relationTarget?.id === node.id)) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Draw node name text
  // Dynamic font size based on zoom level for clarity at different scales
  const fontSize = Math.max(8, Math.min(14, 12 / globalScale));
  ctx.font = `${fontSize}px Sans-Serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Text position: below node
  const textX = node.x;
  const textY = node.y + radius + 4;

  // Get node name, handle long text
  const nodeName = node.name || '';
  const maxWidth = radius * 3;

  // Truncate long text
  let displayText = nodeName;
  if (ctx.measureText(nodeName).width > maxWidth) {
    displayText = nodeName.slice(0, 8) + '...';
  }

  // Draw text background (enhance readability)
  const textWidth = ctx.measureText(displayText).width;
  const textHeight = fontSize;
  const padding = 2;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(
    textX - textWidth / 2 - padding,
    textY - padding / 2,
    textWidth + padding * 2,
    textHeight + padding
  );

  // Draw text
  ctx.fillStyle = '#374151';
  ctx.fillText(displayText, textX, textY);
};

/**
 * Render a link on the canvas
 * @param {Object} params - Rendering parameters
 * @param {Object} params.link - Link to render
 * @param {CanvasRenderingContext2D} params.ctx - Canvas context
 * @param {Object} params.relationStyleMap - Map of relation styles (color, style, direction)
 * @param {Set} params.pathLinkIds - Set of link IDs in the current path
 */
export const renderLink = ({
  link,
  ctx,
  relationStyleMap,
  pathLinkIds,
}) => {
  const start = link.source;
  const end = link.target;

  // Skip invalid nodes
  if (!start || !end || typeof start.x === 'undefined' || typeof end.y === 'undefined') return;

  const relationStyle = relationStyleMap[link.name] || { style: 'solid', direction: 'directed', color: '#9ca3af' };
  const isHighlighted = pathLinkIds.has(link.id);
  const color = isHighlighted ? '#22c55e' : (relationStyle.color || '#9ca3af');

  // Calculate link direction
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return;

  // Unit vector
  const ux = dx / length;
  const uy = dy / length;

  // Node radius offset
  const nodeRadius = 10;
  const startX = start.x + ux * nodeRadius;
  const startY = start.y + uy * nodeRadius;
  const endX = end.x - ux * nodeRadius;
  const endY = end.y - uy * nodeRadius;

  ctx.strokeStyle = color;
  ctx.lineWidth = isHighlighted ? 2.5 : 1.5;

  // Set line style
  if (relationStyle.style === 'dashed') {
    ctx.setLineDash([8, 4]);
  } else if (relationStyle.style === 'dotted') {
    ctx.setLineDash([2, 3]);
  } else {
    ctx.setLineDash([]);
  }

  // Draw link line
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Draw arrow
  const arrowLength = 8;
  const arrowWidth = 4;

  // End arrow (directed and bidirectional)
  if (relationStyle.direction === 'directed' || relationStyle.direction === 'bidirectional') {
    ctx.setLineDash([]); // Arrows don't use dashed lines
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowLength * ux + arrowWidth * uy, endY - arrowLength * uy - arrowWidth * ux);
    ctx.lineTo(endX - arrowLength * ux - arrowWidth * uy, endY - arrowLength * uy + arrowWidth * ux);
    ctx.closePath();
    ctx.fill();
  }

  // Start arrow (bidirectional only)
  if (relationStyle.direction === 'bidirectional') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + arrowLength * ux + arrowWidth * uy, startY + arrowLength * uy - arrowWidth * ux);
    ctx.lineTo(startX + arrowLength * ux - arrowWidth * uy, startY + arrowLength * uy + arrowWidth * ux);
    ctx.closePath();
    ctx.fill();
  }

  // Undirected relations don't need arrows
};