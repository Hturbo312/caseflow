import React from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useI18n } from '../../../../i18n';

/**
 * CreateCaseModal - 创建案例弹窗组件
 */
const CreateCaseModal = ({
  show,
  onClose,
  onCreate,
  newCaseForm,
  setNewCaseForm,
  creatingCase,
  schemas,
  currentSchemaId
}) => {
  const { t } = useI18n();
  if (!show) return null;

  const handleOverlayClick = () => {
    onClose();
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  const handleNameChange = (e) => {
    setNewCaseForm({ ...newCaseForm, name: e.target.value });
  };

  const handleDescriptionChange = (e) => {
    setNewCaseForm({ ...newCaseForm, description: e.target.value });
  };

  const isSubmitDisabled = creatingCase || !newCaseForm.name.trim();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="caseflow-modal-overlay"
      onClick={handleOverlayClick}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={handleModalClick}
        className="caseflow-modal"
      >
        <div className="caseflow-modal-header">
          <h3>{t('case.new')}</h3>
          <button
            onClick={onClose}
            className="caseflow-modal-close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="caseflow-modal-body">
          <div className="caseflow-form-group">
            <label>{t('case.name')} <span className="required">*</span></label>
            <input
              type="text"
              value={newCaseForm.name}
              onChange={handleNameChange}
              placeholder={t('case.name')}
              autoFocus
            />
          </div>
          <div className="caseflow-form-group">
            <label>{t('case.description')}</label>
            <textarea
              value={newCaseForm.description}
              onChange={handleDescriptionChange}
              placeholder={t('case.description')}
              rows={3}
            />
          </div>
          <div className="caseflow-form-group">
            <label>{t('case.schema')}</label>
            <div className="caseflow-schema-tag">
              {schemas.find(s => s.id === currentSchemaId || s.id === parseInt(currentSchemaId))?.name || t('schema.defaultName')}
            </div>
          </div>
        </div>
        <div className="caseflow-modal-footer">
          <button
            onClick={onClose}
            className="caseflow-btn caseflow-btn-secondary"
          >
            {t('toolbar.cancel')}
          </button>
          <button
            onClick={onCreate}
            disabled={isSubmitDisabled}
            className="caseflow-btn caseflow-btn-primary"
          >
            {creatingCase ? (
              <>
                <span className="caseflow-spinner"></span>
                {t('case.creating')}
              </>
            ) : (
              <>
                <Check size={16} />
                {t('case.create')}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CreateCaseModal;