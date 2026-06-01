/**
 * Canvas rendering functions for KnowledgeGraphCanvas
 * Extracted as pure functions for performance optimization
 */

/**
 * Build a simple spatial grid for O(n) collision detection
 * Divides the canvas into cells and maps nodes to cells
 * @param {Array} nodes - Array of nodes with x, y
 * @param {Function} getNodeSize - Function to get node size
 * @param {number} cellSize - Grid cell size (default: 60)
 * @returns {Object} Grid object with cellSize and cells map
 */
export const buildSpatialGrid = (nodes, getNodeSize, cellSize = 60) => {
  const cells = new Map();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (typeof n.x === 'undefined' || typeof n.y === 'undefined') continue;
    const radius = Math.sqrt(getNodeSize(n)) * 4;
    const cellX = Math.floor(n.x / cellSize);
    const cellY = Math.floor(n.y / cellSize);
    // Add to 3x3 neighborhood cells (to handle boundary cases)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push({ id: n.id, x: n.x, y: n.y, radius });
      }
    }
  }
  return { cellSize, cells };
};

/**
 * Render a node on the canvas with hover/focus/dim support
 */
export const renderNode = ({
  node,
  ctx,
  globalScale,
  selectedNode,
  hoveredNode,
  focusedNode,
  highlightedNodeIds,
  pathStartNode,
  pathEndNode,
  relationSource,
  relationTarget,
  pathNodeIds,
  getNodeColor,
  getNodeSize,
  // Spatial grid for O(n) collision detection
  spatialGrid,
}) => {
  if (!node || typeof node.x === 'undefined' || typeof node.y === 'undefined') return;

  const color = getNodeColor(node);
  const size = getNodeSize(node);
  const radius = Math.sqrt(size) * 4;

  // Dimming logic
  const isSelected = selectedNode && node.id === selectedNode.id;
  const isHovered = hoveredNode && node.id === hoveredNode.id;
  const isFocused = focusedNode && node.id === focusedNode.id;

  let alpha = 1;
  const isHighlighted = highlightedNodeIds && highlightedNodeIds.size > 0;
  if (isHighlighted) {
    if (highlightedNodeIds.has(node.id) || isHovered || isFocused || isSelected) {
      alpha = 1;
    } else {
      alpha = 0.15;
    }
  }
  ctx.globalAlpha = alpha;

  // Draw node circle
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  // Borders
  if (isFocused) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (isSelected) {
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else if (isHovered) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if ((pathStartNode?.id === node.id) || (pathEndNode?.id === node.id) ||
      (relationSource?.id === node.id) || (relationTarget?.id === node.id)) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Label visibility — always visible (CPI-style global labels)
  const isPathNode = pathNodeIds && pathNodeIds.has(node.id);
  const inHighlightGroup = highlightedNodeIds && highlightedNodeIds.has(node.id);
  const showLabel = true;

  if (showLabel) {
    const fontSize = isFocused ? 
      Math.max(11, Math.min(17, 15 / globalScale)) :
      (isSelected ? 
        Math.max(10, Math.min(16, 14 / globalScale)) :
        Math.max(9, Math.min(13, 11 / globalScale)));
    ctx.font = `${(isSelected || isFocused) ? 'bold ' : ''}${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const textX = node.x;
    const textY = node.y + radius + 4;
    const nodeName = node.name || '';
    const maxWidth = radius * 5;

    let displayText = nodeName;
    if (ctx.measureText(nodeName).width > maxWidth) {
      const maxChars = Math.floor(maxWidth / fontSize * 1.5);
      displayText = nodeName.slice(0, Math.max(4, maxChars)) + '...';
    }

    const textWidth = ctx.measureText(displayText).width;
    const textHeight = fontSize + 4;
    // Text bounding box
    const textBBox = {
      x: textX - textWidth / 2 - 4,
      y: textY - 2,
      w: textWidth + 8,
      h: textHeight,
    };

    // Collision detection using spatial grid — O(1) average case vs O(n) brute force
    let hasCollision = false;
    const collisionPadding = 4;
    if (spatialGrid) {
      const { cellSize, cells } = spatialGrid;
      const cellX = Math.floor(textX / cellSize);
      const cellY = Math.floor(textY / cellSize);
      // Check only nodes in the same cell (or neighboring cells)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${cellX + dx},${cellY + dy}`;
          const cellNodes = cells.get(key);
          if (!cellNodes) continue;
          for (const other of cellNodes) {
            if (other.id === node.id) continue;
            const closestX = Math.max(textBBox.x, Math.min(other.x, textBBox.x + textBBox.w));
            const closestY = Math.max(textBBox.y, Math.min(other.y, textBBox.y + textBBox.h));
            const ddx = other.x - closestX;
            const ddy = other.y - closestY;
            if (ddx * ddx + ddy * ddy < (other.radius + collisionPadding) * (other.radius + collisionPadding)) {
              hasCollision = true;
              break;
            }
          }
          if (hasCollision) break;
        }
        if (hasCollision) break;
      }
    }

    if (!hasCollision) {
      // No background — clean transparent text (CPI style)
      ctx.fillStyle = '#374151';
      ctx.fillText(displayText, textX, textY);
    }
  }
  
  ctx.globalAlpha = 1;
};

/**
 * Render a link on the canvas with dimming and curvature
 */
export const renderLink = ({
  link,
  ctx,
  relationStyleMap,
  pathLinkIds,
  highlightedNodeIds,
}) => {
  const start = link.source;
  const end = link.target;

  if (!start || !end || typeof start.x === 'undefined' || typeof start.y === 'undefined' || typeof end.x === 'undefined' || typeof end.y === 'undefined') return;

  const srcId = typeof start === 'object' ? start.id : start;
  const tgtId = typeof end === 'object' ? end.id : end;

  const relationStyle = relationStyleMap[link.name] || { style: 'solid', direction: 'directed', color: '#9ca3af' };
  
  // Dimming logic — "data sky" aesthetic: thin, faint but colored lines
  let alpha = 0.35;
  let width = 0.5;
  
  if (pathLinkIds.has(link.id)) {
    alpha = 1;
    width = 2.5;
  } else if (highlightedNodeIds && highlightedNodeIds.size > 0) {
    const srcIn = highlightedNodeIds.has(srcId);
    const tgtIn = highlightedNodeIds.has(tgtId);
    if (srcIn && tgtIn) {
      alpha = 1.0;
      width = 2.0;
    } else {
      alpha = 0.1;
      width = 0.3;
    }
  }
  
  const color = relationStyle.color || '#9ca3af';
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) return;

  const ux = dx / length;
  const uy = dy / length;

  const nodeRadius = 11.31;
  const startX = start.x + ux * nodeRadius;
  const startY = start.y + uy * nodeRadius;
  const endX = end.x - ux * nodeRadius;
  const endY = end.y - uy * nodeRadius;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const offset = Math.min(20, length * 0.15);
  const perpX = -uy;
  const perpY = ux;
  const cpX = midX + perpX * offset;
  const cpY = midY + perpY * offset;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;

  if (relationStyle.style === 'dashed') {
    ctx.setLineDash([6, 4]);
  } else if (relationStyle.style === 'dotted') {
    ctx.setLineDash([2, 3]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(cpX, cpY, endX, endY);
  ctx.stroke();
  
  ctx.restore();
};
