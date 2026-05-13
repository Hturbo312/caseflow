/**
 * Data transformation utilities for API response normalization
 */

import { normalizeId } from './idGenerator';
import { DEFAULT_RELATION_COLOR } from './constants';

/**
 * Transform API case data to frontend format
 * @param {Object} caseData - Raw case data from API
 * @returns {Object} Normalized case data
 */
export const normalizeCase = (caseData) => {
  return {
    ...caseData,
    id: normalizeId(caseData.id),
    schemaId: caseData.schemaId || normalizeId(caseData.schema_id),
    entities: normalizeEntities(caseData.entities || []),
    relations: normalizeRelations(caseData.relations || [])
  };
};

/**
 * Transform API entity data to frontend format
 * @param {Object} entity - Raw entity data from API
 * @returns {Object} Normalized entity data
 */
export const normalizeEntity = (entity) => {
  return {
    ...entity,
    id: normalizeId(entity.id),
    entityType: entity.entityType || entity.entity_type,
    properties: entity.properties || {}
  };
};

/**
 * Transform array of entities
 * @param {Array} entities - Raw entities array
 * @returns {Array} Normalized entities array
 */
export const normalizeEntities = (entities) => {
  return entities.map(normalizeEntity);
};

/**
 * Transform API relation data to frontend format
 * @param {Object} relation - Raw relation data from API
 * @returns {Object} Normalized relation data
 */
export const normalizeRelation = (relation) => {
  return {
    ...relation,
    id: normalizeId(relation.id),
    sourceId: relation.sourceId || normalizeId(relation.source_entity_id),
    targetId: relation.targetId || normalizeId(relation.target_entity_id),
    name: relation.name || relation.relation_type
  };
};

/**
 * Transform array of relations
 * @param {Array} relations - Raw relations array
 * @returns {Array} Normalized relations array
 */
export const normalizeRelations = (relations) => {
  return relations.map(normalizeRelation);
};

/**
 * Transform API schema data to frontend format
 * @param {Object} schema - Raw schema data from API
 * @returns {Object} Normalized schema data
 */
export const normalizeSchema = (schema) => {
  return {
    ...schema,
    id: normalizeId(schema.id),
    entityTypes: normalizeEntityTypes(schema.entityTypes || []),
    relations: normalizeSchemaRelations(schema.relations || [])
  };
};

/**
 * Transform API entity type data to frontend format
 * @param {Object} entityType - Raw entity type data from API
 * @returns {Object} Normalized entity type data
 */
export const normalizeEntityType = (entityType) => {
  return {
    ...entityType,
    id: normalizeId(entityType.id),
    properties: entityType.properties || []
  };
};

/**
 * Transform array of entity types
 * @param {Array} entityTypes - Raw entity types array
 * @returns {Array} Normalized entity types array
 */
export const normalizeEntityTypes = (entityTypes) => {
  return entityTypes.map(normalizeEntityType);
};

/**
 * Transform API schema relation data to frontend format
 * @param {Object} relation - Raw relation data from API
 * @returns {Object} Normalized relation data
 */
export const normalizeSchemaRelation = (relation) => {
  return {
    ...relation,
    id: normalizeId(relation.id),
    from: relation.from_entity_type || relation.from,
    to: relation.to_entity_type || relation.to,
    description: relation.description || '',
    direction: relation.direction || 'directed',
    color: relation.color || DEFAULT_RELATION_COLOR,
    style: relation.style || 'solid'
  };
};

/**
 * Transform array of schema relations
 * @param {Array} relations - Raw relations array
 * @returns {Array} Normalized relations array
 */
export const normalizeSchemaRelations = (relations) => {
  return relations.map(normalizeSchemaRelation);
};

/**
 * Convert frontend entity to API format
 * @param {Object} entity - Frontend entity data
 * @returns {Object} API-formatted entity data
 */
export const entityToApiFormat = (entity) => {
  return {
    name: entity.name,
    entityType: entity.entityType,
    properties: entity.properties
  };
};

/**
 * Convert frontend relation to API format
 * @param {Object} relation - Frontend relation data
 * @returns {Object} API-formatted relation data
 */
export const relationToApiFormat = (relation) => {
  return {
    sourceEntityId: relation.sourceId,
    targetEntityId: relation.targetId,
    relationType: relation.name
  };
};

/**
 * Convert frontend schema relation to API format
 * @param {Object} relation - Frontend relation data
 * @returns {Object} API-formatted relation data
 */
export const schemaRelationToApiFormat = (relation) => {
  return {
    name: relation.name,
    fromEntityType: relation.from,
    toEntityType: relation.to,
    description: relation.description,
    direction: relation.direction || 'directed',
    color: relation.color || DEFAULT_RELATION_COLOR,
    style: relation.style || 'solid'
  };
};