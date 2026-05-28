/**
 * Graph utility functions for knowledge graph operations
 */

/**
 * Build adjacency list from graph links
 * @param {Array} links - Array of graph links
 * @returns {Object} Adjacency list with node IDs as keys and neighbor arrays as values
 */
export const buildAdjacencyList = (links) => {
  const adjacencyList = {};
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    if (!adjacencyList[sourceId]) adjacencyList[sourceId] = [];
    if (!adjacencyList[targetId]) adjacencyList[targetId] = [];

    adjacencyList[sourceId].push({ target: targetId, link });
    adjacencyList[targetId].push({ target: sourceId, link });
  });
  return adjacencyList;
};

/**
 * BFS search to find shortest path between two nodes
 * @param {Object} adjacencyList - Pre-built adjacency list
 * @param {string} startId - Starting node ID
 * @param {string} endId - Target node ID
 * @param {Array} links - Original links array for extracting path links
 * @returns {Object|null} Object with pathLinks and path arrays, or null if no path found
 */
export const bfsSearch = (adjacencyList, startId, endId, links) => {
  const queue = [[startId]];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];

    if (node === endId) {
      // Found path, extract links along the path
      const pathLinks = [];
      for (let i = 0; i < path.length - 1; i++) {
        const link = links.find(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          return (s === path[i] && t === path[i + 1]) || (s === path[i + 1] && t === path[i]);
        });
        if (link) pathLinks.push(link);
      }
      return { pathLinks, path };
    }

    const neighbors = adjacencyList[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.target)) {
        visited.add(neighbor.target);
        queue.push([...path, neighbor.target]);
      }
    }
  }
  return null;
};

/**
 * Find path between two nodes in the graph
 * @param {Array} links - Graph links
 * @param {string} startId - Starting node ID
 * @param {string} endId - Target node ID
 * @returns {Object|null} Path result with links and node IDs
 */
export const findPath = (links, startId, endId) => {
  const adjacencyList = buildAdjacencyList(links);
  return bfsSearch(adjacencyList, startId, endId, links);
};

/**
 * Get node IDs from path result
 * @param {Array} pathResult - Array of links in the path
 * @returns {Set} Set of node IDs in the path
 */
export const getPathNodeIds = (pathResult) => {
  if (pathResult.length === 0) return new Set();
  const ids = new Set();
  pathResult.forEach(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    ids.add(s);
    ids.add(t);
  });
  return ids;
};

/**
 * Get link IDs from path result for quick lookup
 * @param {Array} pathResult - Array of links in the path
 * @returns {Set} Set of link IDs in the path
 */
export const getPathLinkIds = (pathResult) => {
  return new Set(pathResult.map(link => link.id));
};

/**
 * Extract node ID from link source or target
 * @param {Object|string} nodeRef - Link source or target (could be object or string ID)
 * @returns {string} Node ID
 */
export const getNodeIdFromRef = (nodeRef) => {
  return typeof nodeRef === 'object' ? nodeRef.id : nodeRef;
};

/**
 * Filter nodes by search query and entity types
 * @param {Array} nodes - Array of nodes
 * @param {string} searchQuery - Search query string
 * @param {Array} entityTypes - Array of entity type names to filter
 * @returns {Array} Filtered nodes
 */
export const filterNodes = (nodes, searchQuery, entityTypes) => {
  return nodes.filter(node => {
    const nodeName = node.name || '';
    if (searchQuery && !nodeName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (entityTypes && entityTypes.length > 0 && !entityTypes.includes(node.type)) {
      return false;
    }
    return true;
  });
};

/**
 * Filter links based on filtered node IDs
 * @param {Array} links - Array of links
 * @param {Set} nodeIds - Set of valid node IDs
 * @returns {Array} Filtered links
 */
export const filterLinksByNodeIds = (links, nodeIds) => {
  return links.filter(link => {
    const sourceId = getNodeIdFromRef(link.source);
    const targetId = getNodeIdFromRef(link.target);
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });
};

/**
 * Build entity type color map from schema
 * @param {Array} entityTypes - Schema entity types array
 * @returns {Object} Color map with entity type names as keys
 */
export const buildEntityTypeColorMap = (entityTypes) => {
  const map = {};
  entityTypes?.forEach(e => {
    map[e.name] = e.color;
  });
  return map;
};

/**
 * Build relation style map from schema
 * @param {Array} relations - Schema relations array
 * @returns {Object} Style map with relation names as keys
 */
export const buildRelationStyleMap = (relations) => {
  const map = {};
  relations?.forEach(r => {
    const baseName = r.name.replace(/[（(].*$/, '');
    const style = { color: r.color || '#9ca3af', style: r.style || 'solid', direction: r.direction || 'directed' };
    map[r.name] = style;
    if (baseName !== r.name) map[baseName] = style;
  });
  return map;
};

/**
 * Get node color from entity type color map
 * @param {string} type - Entity type name
 * @param {Object} colorMap - Entity type color map
 * @returns {string} Color string
 */
export const getNodeColor = (type, colorMap) => {
  return colorMap[type] || '#9ca3af';
};

/**
 * Search nodes by name (returns matching nodes)
 * @param {Array} nodes - Array of nodes
 * @param {string} searchQuery - Search query string
 * @returns {Array} Matching nodes
 */
export const searchNodesByName = (nodes, searchQuery) => {
  if (!searchQuery || !searchQuery.trim()) return [];
  const query = searchQuery.toLowerCase().trim();
  return nodes.filter(node => {
    const nodeName = (node.name || '').toLowerCase();
    return nodeName.includes(query);
  });
};

/**
 * Get subgraph nodes and links from a starting node with specified depth
 * Uses BFS to expand neighbors up to given depth
 * @param {Array} nodes - All nodes in the graph
 * @param {Array} links - All links in the graph
 * @param {string} startNodeId - Starting node ID
 * @param {number} depth - Maximum depth to expand (0 = only start node, 1 = direct neighbors, etc.)
 * @returns {Object} Object with nodeIds Set and linkIds Set
 */
export const getSubgraphFromNode = (nodes, links, startNodeId, depth) => {
  if (!startNodeId || depth < 0) {
    return { nodeIds: new Set(), linkIds: new Set() };
  }

  const nodeIds = new Set([startNodeId]);
  const linkIds = new Set();

  if (depth === 0) {
    return { nodeIds, linkIds };
  }

  // Build adjacency list for quick neighbor lookup
  const adjacencyList = {};
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    if (!adjacencyList[sourceId]) adjacencyList[sourceId] = [];
    if (!adjacencyList[targetId]) adjacencyList[targetId] = [];

    adjacencyList[sourceId].push({ nodeId: targetId, linkId: link.id, link });
    adjacencyList[targetId].push({ nodeId: sourceId, linkId: link.id, link });
  });

  // BFS expansion
  let currentLevel = [startNodeId];
  for (let d = 0; d < depth; d++) {
    const nextLevel = [];
    for (const nodeId of currentLevel) {
      const neighbors = adjacencyList[nodeId] || [];
      for (const neighbor of neighbors) {
        if (!nodeIds.has(neighbor.nodeId)) {
          nodeIds.add(neighbor.nodeId);
          linkIds.add(neighbor.linkId);
          nextLevel.push(neighbor.nodeId);
        } else if (!linkIds.has(neighbor.linkId)) {
          // Add link even if node already visited (for links between nodes at same level)
          linkIds.add(neighbor.linkId);
        }
      }
    }
    currentLevel = nextLevel;
    if (currentLevel.length === 0) break;
  }

  // Add links between nodes already in the set
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    if (nodeIds.has(sourceId) && nodeIds.has(targetId) && !linkIds.has(link.id)) {
      linkIds.add(link.id);
    }
  });

  return { nodeIds, linkIds };
};