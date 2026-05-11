/**
 * Shared constants for the CaseFlow application
 */

// ============================================
// Schema Constants
// ============================================

/**
 * Property type definitions for entity attributes
 */
export const PROPERTY_TYPES = [
  { value: 'text', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' },
  { value: 'boolean', label: '布尔值' },
  { value: 'enum', label: '枚举' },
];

/**
 * Relation line style options
 */
export const RELATION_STYLES = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' },
];

/**
 * Relation direction options
 */
export const RELATION_DIRECTIONS = [
  { value: 'directed', label: '有向' },
  { value: 'bidirectional', label: '双向' },
  { value: 'undirected', label: '无向' },
];

/**
 * Preset color palette for entities and relations
 */
export const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316',
  '#ec4899', '#6366f1', '#14b8a6', '#eab308'
];

/**
 * Default entity color
 */
export const DEFAULT_ENTITY_COLOR = '#9ca3af';

/**
 * Default relation color
 */
export const DEFAULT_RELATION_COLOR = '#9ca3af';

// ============================================
// Graph Constants
// ============================================

/**
 * Default node size for graph visualization
 */
export const DEFAULT_NODE_SIZE = 8;

/**
 * Highlighted node size for path analysis
 */
export const HIGHLIGHTED_NODE_SIZE = 10;

/**
 * Start/end node size for path analysis
 */
export const PATH_ENDPOINT_NODE_SIZE = 12;

/**
 * Graph zoom levels
 */
export const ZOOM_STEP = 1.3;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

/**
 * Graph layout padding for zoomToFit
 */
export const GRAPH_PADDING = 80;

// ============================================
// API Constants
// ============================================

/**
 * API base URL path
 */
export const API_BASE_URL = '/api';

/**
 * Auth token storage key
 */
export const TOKEN_KEY = 'caseflow_token';

// ============================================
// UI Constants
// ============================================

/**
 * Animation duration for standard transitions (ms)
 */
export const ANIMATION_DURATION = 250;

/**
 * Fast animation duration (ms)
 */
export const FAST_ANIMATION_DURATION = 150;

/**
 * Z-index levels for UI layers
 */
export const Z_INDEX = {
  BASE: 0,
  SIDEBAR: 10,
  DRAWER: 20,
  MODAL: 50,
  TOOLTIP: 60,
  NOTIFICATION: 70,
};

/**
 * Default sidebar width (px)
 */
export const DEFAULT_SIDEBAR_WIDTH = 280;

/**
 * Collapsed sidebar width (px)
 */
export const COLLAPSED_SIDEBAR_WIDTH = 60;