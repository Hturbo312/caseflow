/**
 * Utils module entry point
 * Export all utility functions and constants
 */

// Graph utilities
export {
  buildAdjacencyList,
  bfsSearch,
  findPath,
  getPathNodeIds,
  getPathLinkIds,
  getNodeIdFromRef,
  filterNodes,
  filterLinksByNodeIds,
  buildEntityTypeColorMap,
  buildRelationStyleMap,
  getNodeColor,
  searchNodesByName,
  getSubgraphFromNode,
} from './graphUtils';

// ID generation
export {
  generateId,
  generateEntityId,
  generateRelationId,
  generateCaseId,
  generateSchemaId,
  generatePropertyId,
  generateMessageId,
  generateSessionId,
  normalizeId,
  idsMatch,
} from './idGenerator';

// Constants
export {
  PROPERTY_TYPES,
  RELATION_STYLES,
  RELATION_DIRECTIONS,
  PRESET_COLORS,
  DEFAULT_ENTITY_COLOR,
  DEFAULT_RELATION_COLOR,
  DEFAULT_NODE_SIZE,
  HIGHLIGHTED_NODE_SIZE,
  PATH_ENDPOINT_NODE_SIZE,
  ZOOM_STEP,
  MIN_ZOOM,
  MAX_ZOOM,
  GRAPH_PADDING,
  API_BASE_URL,
  TOKEN_KEY,
  ANIMATION_DURATION,
  FAST_ANIMATION_DURATION,
  Z_INDEX,
  DEFAULT_SIDEBAR_WIDTH,
  COLLAPSED_SIDEBAR_WIDTH,
} from './constants';

// Auth helper
export {
  authHelper,
  getAuthHeaders,
  clearAuth,
} from './authHelper';

// Prompt templates
export {
  caseExtractionPrompt,
  simpleExtractionPrompt,
  ragQueryPrompt,
} from './promptTemplates';

// Data transformation
export {
  normalizeCase,
  normalizeEntity,
  normalizeEntities,
  normalizeRelation,
  normalizeRelations,
  normalizeSchema,
  normalizeEntityType,
  normalizeEntityTypes,
  normalizeSchemaRelation,
  normalizeSchemaRelations,
  entityToApiFormat,
  relationToApiFormat,
  schemaRelationToApiFormat,
} from './dataTransform';