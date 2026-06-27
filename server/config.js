import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

export const JWT_SECRET = process.env.JWT_SECRET || 'caseflow-secret-key-change-in-production';
export const PORT = process.env.PORT || 3000;

// AI 配置存储（从环境变量初始化，可通过API覆盖）
export let aiConfigCache = {
  endpoint: process.env.AI_ENDPOINT || '',
  apiKey: process.env.AI_API_KEY || '',
  model: process.env.AI_MODEL || 'glm-4-flash',
  temperature: 0.7,
  maxTokens: 16384,
  useTemperature: true,
  useMaxTokens: true,
  embeddingEndpoint: process.env.AI_EMBEDDING_ENDPOINT || '',
  embeddingModel: process.env.AI_EMBEDDING_MODEL || 'embedding-2',
};

export function updateAiConfig(newConfig) {
  if (newConfig.apiKey !== undefined) aiConfigCache.apiKey = newConfig.apiKey;
  if (newConfig.endpoint !== undefined) aiConfigCache.endpoint = newConfig.endpoint;
  if (newConfig.model !== undefined) aiConfigCache.model = newConfig.model;
  if (newConfig.temperature !== undefined) aiConfigCache.temperature = newConfig.temperature;
  if (newConfig.maxTokens !== undefined) aiConfigCache.maxTokens = newConfig.maxTokens;
  if (newConfig.useTemperature !== undefined) aiConfigCache.useTemperature = newConfig.useTemperature;
  if (newConfig.useMaxTokens !== undefined) aiConfigCache.useMaxTokens = newConfig.useMaxTokens;
  if (newConfig.embeddingEndpoint !== undefined) aiConfigCache.embeddingEndpoint = newConfig.embeddingEndpoint;
  if (newConfig.embeddingModel !== undefined) aiConfigCache.embeddingModel = newConfig.embeddingModel;
}

export function resetAiConfig() {
  aiConfigCache = {
    endpoint: '',
    apiKey: '',
    model: 'glm-4-flash',
    temperature: 0.7,
    maxTokens: 16384,
    useTemperature: true,
    useMaxTokens: true,
    embeddingEndpoint: '',
    embeddingModel: 'embedding-2',
  };
}

// 允许使用全局 AI 配置的白名单用户 ID（逗号分隔）
// 不在白名单的用户必须自己配置 AI API key，否则无法使用 AI 功能
export const ALLOWED_USER_IDS = (process.env.AI_ALLOWED_USER_IDS || '1')
  .split(',')
  .map(id => parseInt(id.trim(), 10))
  .filter(id => !isNaN(id));

console.log('AI白名单用户:', ALLOWED_USER_IDS);

console.log('AI配置状态:', {
  configured: !!(aiConfigCache.apiKey && aiConfigCache.endpoint),
  endpoint: aiConfigCache.endpoint,
  model: aiConfigCache.model,
  hasApiKey: !!aiConfigCache.apiKey
});