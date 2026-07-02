import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// JWT_SECRET: 优先使用环境变量，否则生成随机密钥并警告
const _jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('');
  console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.warn('!! [安全警告] JWT_SECRET 未设置，已生成临时随机密钥。       !!');
  console.warn('!! 服务重启后所有用户登录态将失效。                         !!');
  console.warn('!! 生产环境请在 .env 中设置 JWT_SECRET=<你的密钥>           !!');
  console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.warn('');
}
export const JWT_SECRET = _jwtSecret;

export const PORT = process.env.PORT || 3000;

// AI 配置存储（从环境变量初始化，可通过API覆盖）
export let aiConfigCache = {
  endpoint: process.env.AI_ENDPOINT || '',
  apiKey: process.env.AI_API_KEY || '',
  model: process.env.AI_MODEL || 'glm-4.7-flash',
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
    model: 'glm-4.7-flash',
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