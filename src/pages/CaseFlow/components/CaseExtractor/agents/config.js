import { MessageSquare, Wand2, Database } from 'lucide-react';

/**
 * AI Agent 配置 — 每个 Agent 的图标、颜色、标题、描述等
 */
export const createAgentConfig = (t) => ({
  schema_builder: {
    icon: Database,
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    title: t('ai.schemaBuilder'),
    subtitle: t('ai.schemaBuilderDesc'),
    placeholder: t('ai.schemaBuilderPlaceholder')
  },
  case_extractor: {
    icon: Wand2,
    color: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    title: t('ai.caseBreakdown'),
    subtitle: t('ai.caseBreakdownDesc'),
    placeholder: t('ai.caseBreakdownPlaceholder')
  },
  analysis_assistant: {
    icon: MessageSquare,
    color: 'from-cyan-500 to-blue-500',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-600',
    title: t('ai.conversationAnalysis'),
    subtitle: t('ai.conversationDesc'),
    placeholder: t('ai.conversationPlaceholder')
  }
});
