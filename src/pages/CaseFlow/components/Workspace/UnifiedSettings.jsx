import { useState } from 'react';
import { X, Shield, SlidersHorizontal, Languages, Palette, Users } from 'lucide-react';
import { useAuthStore } from '../../../../store';
import { useI18n } from '../../../../i18n';
import { useAIConfig } from '../CaseExtractor/hooks/useAIConfig';
import SettingsModal from '../CaseExtractor/SettingsModal';
import AdminPanel from './AdminPanel';

/**
 * 统一设置弹窗（顶栏用户名旁 ⚙ 入口）
 * 分区：AI 配置 / 通用设置（风格·语言）/ 用户管理（仅管理员）
 */
export default function UnifiedSettings({ isOpen, onClose }) {
  const { t, locale, setLocale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const ai = useAIConfig();

  const [section, setSection] = useState('ai');
  const [usersOpen, setUsersOpen] = useState(false);
  const [density, setDensity] = useState(
    () => localStorage.getItem('caseflow_density') || 'cozy'
  );

  if (!isOpen) return null;

  const applyDensity = (d) => {
    setDensity(d);
    localStorage.setItem('caseflow_density', d);
    document.documentElement.setAttribute('data-density', d);
  };
  // 初始同步一次（模块级副作用放渲染外不可行，这里幂等设置）
  document.documentElement.setAttribute('data-density', density);

  const sections = [
    { id: 'ai', label: t('settings.ai'), icon: Shield },
    { id: 'general', label: t('settings.general'), icon: SlidersHorizontal },
    ...(isAdmin ? [{ id: 'users', label: t('settings.users'), icon: Users }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="ws-settings" onClick={(e) => e.stopPropagation()}>
        <div className="ws-settings-head">
          <h2>{t('settings.title')}</h2>
          <button className="ws-admin-close" onClick={onClose} aria-label={t('settings.close')}><X size={16} /></button>
        </div>

        <div className="ws-settings-body">
          {/* 左侧分区导航 */}
          <nav className="ws-settings-nav">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`ws-settings-nav-item ${section === id ? 'active' : ''}`}
                onClick={() => setSection(id)}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </nav>

          {/* 右侧内容 */}
          <div className="ws-settings-content">
            {section === 'ai' && (
              <SettingsModal
                showSettings
                embedded
                isAuthenticated
                configStatus={ai.configStatus}
                localConfig={ai.localConfig}
                isSavingConfig={ai.isSavingConfig}
                showApiKey={ai.showApiKey}
                onSaveConfig={ai.handleSaveConfig}
                onDeleteConfig={ai.handleDeleteConfig}
                onClose={() => {}}
                onSetLocalConfig={ai.updateLocalConfig}
                onToggleApiKey={() => ai.setShowApiKey(!ai.showApiKey)}
              />
            )}

            {section === 'general' && (
              <div className="ws-settings-section">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-cyan-500" />
                  <h3 className="text-lg font-bold">{t('settings.general')}</h3>
                </div>

                <div className="ws-settings-field">
                  <label>{t('settings.language')}</label>
                  <div className="ws-settings-seg">
                    <button
                      className={locale === 'zh' ? 'active' : ''}
                      onClick={() => setLocale('zh')}
                    >
                      中文
                    </button>
                    <button
                      className={locale === 'en' ? 'active' : ''}
                      onClick={() => setLocale('en')}
                    >
                      English
                    </button>
                  </div>
                </div>

                <div className="ws-settings-field">
                  <label>{t('settings.style')}</label>
                  <div className="ws-settings-seg">
                    <button
                      className={density === 'cozy' ? 'active' : ''}
                      onClick={() => applyDensity('cozy')}
                    >
                      {t('settings.styleCozy')}
                    </button>
                    <button
                      className={density === 'compact' ? 'active' : ''}
                      onClick={() => applyDensity('compact')}
                    >
                      {t('settings.styleCompact')}
                    </button>
                  </div>
                  <p className="ws-settings-hint">{t('settings.styleHint')}</p>
                </div>
              </div>
            )}

            {section === 'users' && isAdmin && (
              <div className="ws-settings-section">
                <div className="flex items-center gap-2 mb-4">
                  <Languages className="w-5 h-5 text-cyan-500 hidden" />
                  <h3 className="text-lg font-bold">{t('settings.users')}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">{t('settings.usersHint')}</p>
                <button className="ws-act ok" onClick={() => setUsersOpen(true)}>
                  <Users size={12} /> {t('settings.usersOpen')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 用户管理独立弹窗，叠加于设置之上 */}
      <AdminPanel isOpen={usersOpen} onClose={() => setUsersOpen(false)} />
    </div>
  );
}
