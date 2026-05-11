import React from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';

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
          <h3>新建案例</h3>
          <button
            onClick={onClose}
            className="caseflow-modal-close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="caseflow-modal-body">
          <div className="caseflow-form-group">
            <label>案例名称 <span className="required">*</span></label>
            <input
              type="text"
              value={newCaseForm.name}
              onChange={handleNameChange}
              placeholder="输入案例名称"
              autoFocus
            />
          </div>
          <div className="caseflow-form-group">
            <label>案例描述</label>
            <textarea
              value={newCaseForm.description}
              onChange={handleDescriptionChange}
              placeholder="输入案例描述（可选）"
              rows={3}
            />
          </div>
          <div className="caseflow-form-group">
            <label>关联 Schema</label>
            <div className="caseflow-schema-tag">
              {schemas.find(s => s.id === currentSchemaId || s.id === parseInt(currentSchemaId))?.name || '默认 Schema'}
            </div>
          </div>
        </div>
        <div className="caseflow-modal-footer">
          <button
            onClick={onClose}
            className="caseflow-btn caseflow-btn-secondary"
          >
            取消
          </button>
          <button
            onClick={onCreate}
            disabled={isSubmitDisabled}
            className="caseflow-btn caseflow-btn-primary"
          >
            {creatingCase ? (
              <>
                <span className="caseflow-spinner"></span>
                创建中...
              </>
            ) : (
              <>
                <Check size={16} />
                创建案例
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CreateCaseModal;