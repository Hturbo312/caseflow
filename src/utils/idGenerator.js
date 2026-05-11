/**
 * ID generation utilities for entities, relations, and other objects
 */

/**
 * Generate a unique ID with prefix
 * @param {string} prefix - ID prefix (e.g., 'e' for entity, 'r' for relation)
 * @returns {string} Unique ID string
 */
export const generateId = (prefix = 'id') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Generate entity ID
 * @returns {string} Entity ID with 'e' prefix
 */
export const generateEntityId = () => generateId('e');

/**
 * Generate relation ID
 * @returns {string} Relation ID with 'r' prefix
 */
export const generateRelationId = () => generateId('r');

/**
 * Generate case ID
 * @returns {string} Case ID with 'case' prefix
 */
export const generateCaseId = () => generateId('case');

/**
 * Generate schema ID
 * @returns {string} Schema ID with 'schema' prefix
 */
export const generateSchemaId = () => generateId('schema');

/**
 * Generate property ID
 * @returns {string} Property ID with 'prop' prefix
 */
export const generatePropertyId = () => generateId('prop');

/**
 * Generate message ID
 * @returns {string} Message ID with 'msg' prefix
 */
export const generateMessageId = () => generateId('msg');

/**
 * Generate session ID
 * @returns {string} Session ID with 'session' prefix
 */
export const generateSessionId = () => generateId('session');

/**
 * Convert ID to string format (handles both string and number IDs)
 * @param {string|number} id - ID value
 * @returns {string} String ID
 */
export const normalizeId = (id) => {
  if (id === null || id === undefined) return null;
  return id?.toString();
};

/**
 * Check if two IDs match (handles string/number comparison)
 * @param {string|number} id1 - First ID
 * @param {string|number} id2 - Second ID
 * @returns {boolean} True if IDs match
 */
export const idsMatch = (id1, id2) => {
  if (id1 == null || id2 == null) return false;
  const normalized1 = String(id1);
  const normalized2 = String(id2);
  return normalized1 === normalized2 ||
         parseInt(normalized1, 10) === parseInt(normalized2, 10);
};