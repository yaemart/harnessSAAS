import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { prisma } from './db.js';
import { env } from './env.js';

export enum WorkType {
  PORTAL_SUPPORT_RESPONSE = 'portal_support_response',
  MEDIA_ANALYSIS = 'media_analysis',
  KNOWLEDGE_STRUCTURING = 'knowledge_structuring',
  CONTENT_GENERATION = 'content_generation',
  ANALYTICS_FORECAST = 'analytics_forecast',
  MULTIMODAL_ANALYSIS = 'multimodal_analysis',
}

export const WORK_TYPE_META: Record<WorkType, { label: string; description: string; available: boolean }> = {
  [WorkType.PORTAL_SUPPORT_RESPONSE]: { label: 'Support Response', description: 'Customer support, FAQ, and conversational AI', available: true },
  [WorkType.MEDIA_ANALYSIS]: { label: 'Media Analysis', description: 'Image quality detection, visual tagging', available: true },
  [WorkType.KNOWLEDGE_STRUCTURING]: { label: 'Knowledge & Structuring', description: 'Knowledge graph, information extraction, data structuring', available: true },
  [WorkType.CONTENT_GENERATION]: { label: 'Content Generation', description: 'Product titles, descriptions, SEO copy', available: false },
  [WorkType.ANALYTICS_FORECAST]: { label: 'Analytics & Forecast', description: 'Sales prediction, inventory analysis', available: false },
  [WorkType.MULTIMODAL_ANALYSIS]: { label: 'Multi-modal Analysis', description: 'Combined image + text processing', available: false },
};

export interface ModelCallOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StreamChunk {
  text: string;
  done: boolean;
}

export interface ModelCatalogItem {
  id: string;
  name: string;
  description: string;
  isLegacy?: boolean;
}

export interface AIProvider {
  call(model: string, prompt: string, options?: ModelCallOptions): Promise<string>;
  stream(model: string, prompt: string, options?: ModelCallOptions): AsyncGenerator<StreamChunk>;
  callWithMedia(
    model: string,
    prompt: string,
    media: { mimeType: string; data: string },
    options?: ModelCallOptions,
  ): Promise<string>;
}

class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async call(model: string, prompt: string, options?: ModelCallOptions): Promise<string> {
    const response: GenerateContentResponse = await this.ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: options?.systemInstruction,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxOutputTokens,
      },
    });
    return response.text ?? '';
  }

  async *stream(model: string, prompt: string, options?: ModelCallOptions): AsyncGenerator<StreamChunk> {
    const response = await this.ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        systemInstruction: options?.systemInstruction,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxOutputTokens,
      },
    });

    for await (const chunk of response) {
      const text = chunk.text ?? '';
      if (text) {
        yield { text, done: false };
      }
    }
    yield { text: '', done: true };
  }

  async callWithMedia(
    model: string,
    prompt: string,
    media: { mimeType: string; data: string },
    options?: ModelCallOptions,
  ): Promise<string> {
    const response = await this.ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: media.mimeType, data: media.data } },
            { text: prompt },
          ],
        },
      ],
      config: {
        systemInstruction: options?.systemInstruction,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxOutputTokens,
      },
    });
    return response.text ?? '';
  }
}

export const DEFAULT_MODELS: Record<WorkType, string> = {
  [WorkType.PORTAL_SUPPORT_RESPONSE]: 'gemini-2.5-flash',
  [WorkType.MEDIA_ANALYSIS]: 'gemini-2.5-flash',
  [WorkType.KNOWLEDGE_STRUCTURING]: 'gemini-2.5-flash',
  [WorkType.CONTENT_GENERATION]: 'gemini-2.5-flash',
  [WorkType.ANALYTICS_FORECAST]: 'gemini-3.1-pro',
  [WorkType.MULTIMODAL_ANALYSIS]: 'gemini-3.1-pro',
};

export const DEFAULT_MODEL_ID = DEFAULT_MODELS[WorkType.PORTAL_SUPPORT_RESPONSE];
export const MODEL_CATALOG: ModelCatalogItem[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Fast and cost-effective default choice',
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    description: 'Higher reasoning capability for complex tasks',
  },
  {
    id: 'gemini-3.0',
    name: 'Gemini 3.0',
    description: 'Balanced performance and cost',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Previous generation fast model',
    isLegacy: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Legacy fast model',
    isLegacy: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Legacy high reasoning model',
    isLegacy: true,
  },
];

export interface AIConfig {
  geminiKey?: string;
  modelId?: string;
  models?: Partial<Record<WorkType, string>>;
  _tenantModelId?: string;
  _platformModelId?: string;
  _tenantModels?: Partial<Record<WorkType, string>>;
  _platformModels?: Partial<Record<WorkType, string>>;
}

export const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

async function resolveConfig(tenantId: string): Promise<{ apiKey: string; config: AIConfig; keySource: 'tenant' | 'platform' | 'none' }> {
  const tenantPolicy = await prisma.policyConfig.findFirst({
    where: { tenantId, policyKey: 'ai_integrations' },
  });
  const tenantConfig = (tenantPolicy?.policyValue as AIConfig) ?? {};

  const platformPolicy = await prisma.policyConfig.findFirst({
    where: { tenantId: SYSTEM_TENANT_ID, policyKey: 'platform_ai_config' },
  });
  const platformConfig = (platformPolicy?.policyValue as AIConfig) ?? {};

  let keySource: 'tenant' | 'platform' | 'none' = 'none';
  let apiKey = '';

  if (tenantConfig.geminiKey) {
    apiKey = tenantConfig.geminiKey;
    keySource = 'tenant';
  } else if (platformConfig.geminiKey || env.GEMINI_API_KEY) {
    apiKey = platformConfig.geminiKey || env.GEMINI_API_KEY || '';
    keySource = 'platform';
  }

  if (!apiKey) {
    throw new ModelRouterError('AI is not configured. Set a platform key or tenant BYOK key.');
  }

  const mergedConfig: AIConfig = {
    geminiKey: apiKey,
    modelId: tenantConfig.modelId ?? platformConfig.modelId,
    models: { ...platformConfig.models, ...tenantConfig.models },
    _tenantModelId: tenantConfig.modelId,
    _platformModelId: platformConfig.modelId,
    _tenantModels: tenantConfig.models,
    _platformModels: platformConfig.models,
  };

  return { apiKey, config: mergedConfig, keySource };
}

function resolveModel(workType: WorkType, config: AIConfig): string {
  if (config._tenantModels?.[workType]) return config._tenantModels[workType]!;
  if (config._tenantModelId) return config._tenantModelId;
  if (config._platformModels?.[workType]) return config._platformModels[workType]!;
  if (config._platformModelId) return config._platformModelId;
  return DEFAULT_MODELS[workType];
}

function createProvider(apiKey: string): AIProvider {
  return new GeminiProvider(apiKey);
}

export class ModelRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelRouterError';
  }
}

export const ModelRouter = {
  async call(
    workType: WorkType,
    tenantId: string,
    prompt: string,
    options?: ModelCallOptions,
  ): Promise<string> {
    const { apiKey, config } = await resolveConfig(tenantId);
    const model = resolveModel(workType, config);
    const provider = createProvider(apiKey);
    return provider.call(model, prompt, options);
  },

  async *stream(
    workType: WorkType,
    tenantId: string,
    prompt: string,
    options?: ModelCallOptions,
  ): AsyncGenerator<StreamChunk> {
    const { apiKey, config } = await resolveConfig(tenantId);
    const model = resolveModel(workType, config);
    const provider = createProvider(apiKey);
    yield* provider.stream(model, prompt, options);
  },

  async callWithMedia(
    workType: WorkType,
    tenantId: string,
    prompt: string,
    media: { mimeType: string; data: string },
    options?: ModelCallOptions,
  ): Promise<string> {
    const { apiKey, config } = await resolveConfig(tenantId);
    const model = resolveModel(workType, config);
    const provider = createProvider(apiKey);
    return provider.callWithMedia(model, prompt, media, options);
  },

  async probe(apiKey: string, model: string, prompt = "Respond only with 'OK'"): Promise<string> {
    const provider = createProvider(apiKey);
    return provider.call(model, prompt);
  },
};
