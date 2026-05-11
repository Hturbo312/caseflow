/**
 * useCaseData - Custom hook for case data management
 *
 * Extracts case CRUD and selection logic from CaseFlow and CaseDetail.
 * Provides unified interface for:
 * - Case selection (currentCaseId and focusCaseId)
 * - Case filtering by schema
 * - Entity/Relation CRUD operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useCaseStore, useGraphStore, useSchemaStore } from '../store';
import { caseApi } from '../services/api';
import { useToastStore } from '../components/Toast/ToastStore';
import { idsMatch, normalizeId } from '../utils/idGenerator';
import {
  getCaseSchemaName as lookupCaseSchemaName,
  DEFAULT_CASE_FORM
} from '../pages/CaseFlow/components/CaseManagement/utils';

/**
 * Custom hook for case data management
 *
 * @returns {Object} Hook return object containing:
 *   - cases: Array of all cases
 *   - filteredCases: Cases filtered by current schema (memoized)
 *   - currentCaseId: Currently selected case ID
 *   - focusCaseId: Currently focused case ID in graph
 *   - selectedCaseId: Unified selected case ID (currentCaseId || focusCaseId)
 *   - currentCase: Current case object
 *   - isLoading: Loading state
 *   - Various action handlers
 */
export const useCaseData = () => {
  const {
    cases,
    currentCaseId,
    setCurrentCase,
    loadCases,
    isLoading: casesLoading,
    addCase,
    deleteCase,
    addEntityToCase,
    addRelationToCase,
    deleteEntityFromCase,
    deleteRelationFromCase,
    getCurrentCase
  } = useCaseStore();

  const {
    focusCaseId,
    setFocusCase,
    addNodeToGraph,
    addLinkToGraph,
    removeNodeFromGraph,
    removeLinkFromGraph,
    loadAllCasesToGraph
  } = useGraphStore();

  const { currentSchemaId, schemas } = useSchemaStore();
  const { error: showError } = useToastStore();

  // Create case form state (for CreateCaseModal integration)
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [newCaseForm, setNewCaseForm] = useState(DEFAULT_CASE_FORM);
  const [creatingCase, setCreatingCase] = useState(false);

  // Current case (computed from store)
  const currentCase = getCurrentCase();

  /**
   * Unified selected case ID getter
   * Returns currentCaseId if set, otherwise focusCaseId
   * These two IDs are usually synchronized, but this provides a fallback
   */
  const selectedCaseId = useMemo(() => {
    return currentCaseId || focusCaseId;
  }, [currentCaseId, focusCaseId]);

  /**
   * Filtered cases by current schema (memoized)
   * Uses idsMatch for robust ID comparison
   */
  const filteredCases = useMemo(() => {
    if (!currentSchemaId) return cases;
    return cases.filter(caseItem => {
      const caseSchemaId = caseItem.schemaId || caseItem.schema_id;
      return idsMatch(caseSchemaId, currentSchemaId);
    });
  }, [cases, currentSchemaId]);

  /**
   * Handle case selection - toggle focus
   * Synchronizes both currentCaseId and focusCaseId
   *
   * @param {Object} caseItem - Case to select
   */
  const handleCaseSelect = useCallback((caseItem) => {
    const currentFocusId = focusCaseId;
    const caseId = normalizeId(caseItem.id);

    if (idsMatch(currentFocusId, caseId)) {
      // Click selected case again, deselect
      setCurrentCase(null);
      setFocusCase(null);
    } else {
      // Select new case
      setCurrentCase(caseId);
      setFocusCase(caseId);
    }
  }, [focusCaseId, setCurrentCase, setFocusCase]);

  /**
   * Handle case deselection
   */
  const handleCaseDeselect = useCallback(() => {
    setCurrentCase(null);
    setFocusCase(null);
  }, [setCurrentCase, setFocusCase]);

  /**
   * Create new case via API
   * This method is kept for backward compatibility with CreateCaseModal
   * Prefer using useCreateCase hook for new implementations
   *
   * @param {boolean} isAuthenticated - Auth state
   * @param {Function} onShowLogin - Login modal callback
   * @returns {Promise<boolean>} Success status
   */
  const handleCreateCase = useCallback(async (isAuthenticated, onShowLogin) => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return false;
    }

    if (!newCaseForm.name.trim()) {
      showError('请输入案例名称');
      return false;
    }

    setCreatingCase(true);
    try {
      const response = await caseApi.create({
        name: newCaseForm.name,
        description: newCaseForm.description,
        schemaId: currentSchemaId
      });

      const newCase = {
        ...response.case,
        id: normalizeId(response.case.id),
        schemaId: response.case.schema_id?.toString() || currentSchemaId,
        entities: [],
        relations: []
      };

      // Update local state
      addCase(newCase);

      // Select new case (sync both IDs)
      setCurrentCase(newCase.id);
      setFocusCase(newCase.id);

      // Close modal and reset form
      setShowCreateCase(false);
      setNewCaseForm(DEFAULT_CASE_FORM);

      return true;
    } catch (error) {
      console.error('Create case failed:', error);
      showError('Create case failed: ' + error.message);
      return false;
    } finally {
      setCreatingCase(false);
    }
  }, [newCaseForm, currentSchemaId, addCase, setCurrentCase, setFocusCase, showError]);

  /**
   * Delete case
   *
   * @param {Object} caseItem - Case to delete
   * @returns {Promise<boolean>} Success status
   */
  const handleDeleteCase = useCallback(async (caseItem) => {
    if (!confirm(`确定要删除案例"${caseItem.name}"吗？`)) return false;

    try {
      await deleteCase(caseItem.id);
      // Clear selection if deleted case was selected
      if (idsMatch(focusCaseId, caseItem.id)) {
        handleCaseDeselect();
      }
      return true;
    } catch (error) {
      console.error('Delete case failed:', error);
      return false;
    }
  }, [deleteCase, focusCaseId, handleCaseDeselect]);

  /**
   * Add entity to current case
   *
   * @param {Object} entity - Entity data
   * @returns {Promise<Object|null>} Saved entity or null
   */
  const handleAddEntity = useCallback(async (entity) => {
    if (!currentCaseId) return null;

    const savedEntity = await addEntityToCase(currentCaseId, {
      ...entity,
      id: `e-${Date.now()}`,
    });

    if (savedEntity) {
      addNodeToGraph(savedEntity);
    }

    return savedEntity;
  }, [currentCaseId, addEntityToCase, addNodeToGraph]);

  /**
   * Add relation to current case
   *
   * @param {Object} relation - Relation data
   * @returns {Promise<Object|null>} Saved relation or null
   */
  const handleAddRelation = useCallback(async (relation) => {
    if (!currentCaseId) return null;

    const savedRelation = await addRelationToCase(currentCaseId, {
      ...relation,
      id: `r-${Date.now()}`,
    });

    if (savedRelation) {
      addLinkToGraph(savedRelation);
    }

    return savedRelation;
  }, [currentCaseId, addRelationToCase, addLinkToGraph]);

  /**
   * Delete entity from current case
   *
   * @param {string} entityId - Entity ID to delete
   * @returns {Promise<boolean>} Success status
   */
  const handleDeleteEntity = useCallback(async (entityId) => {
    if (!currentCaseId) return false;

    await deleteEntityFromCase(currentCaseId, entityId);
    removeNodeFromGraph(entityId);
    return true;
  }, [currentCaseId, deleteEntityFromCase, removeNodeFromGraph]);

  /**
   * Delete relation from current case
   *
   * @param {string} relationId - Relation ID to delete
   * @returns {Promise<boolean>} Success status
   */
  const handleDeleteRelation = useCallback(async (relationId) => {
    if (!currentCaseId) return false;

    await deleteRelationFromCase(currentCaseId, relationId);
    removeLinkFromGraph(relationId);
    return true;
  }, [currentCaseId, deleteRelationFromCase, removeLinkFromGraph]);

  /**
   * Get schema name for a case
   * Uses utility function from schemaFilter
   *
   * @param {Object} caseItem - Case to lookup schema name
   * @returns {string} Schema name or '未关联 Schema'
   */
  const getCaseSchemaName = useCallback((caseItem) => {
    return lookupCaseSchemaName(caseItem, schemas);
  }, [schemas]);

  /**
   * Check if a case is currently selected
   *
   * @param {string|number} caseId - Case ID to check
   * @returns {boolean} True if case is selected
   */
  const isCaseSelected = useCallback((caseId) => {
    return idsMatch(selectedCaseId, caseId);
  }, [selectedCaseId]);

  /**
   * Find case by ID
   *
   * @param {string|number} caseId - Case ID to find
   * @returns {Object|null} Case object or null
   */
  const findCaseById = useCallback((caseId) => {
    return cases.find(c => idsMatch(c.id, caseId)) || null;
  }, [cases]);

  return {
    // State
    cases,
    filteredCases,
    currentCaseId,
    focusCaseId,
    selectedCaseId, // Unified getter
    currentCase,
    casesLoading,
    showCreateCase,
    newCaseForm,
    creatingCase,

    // Actions
    setShowCreateCase,
    setNewCaseForm,
    loadCases,
    handleCaseSelect,
    handleCaseDeselect,
    handleCreateCase,
    handleDeleteCase,
    handleAddEntity,
    handleAddRelation,
    handleDeleteEntity,
    handleDeleteRelation,
    getCaseSchemaName,
    setCurrentCase,
    loadAllCasesToGraph,

    // Utilities
    isCaseSelected,
    findCaseById,
  };
};

export default useCaseData;