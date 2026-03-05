import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { prisma } from './db.js';
import { env } from './env.js';

export enum WorkType {
  PORTAL_SUPPORT_RESPONSE = 'portal_support_response',
  MEDIA_ANALYSIS = 'media_analysis',
  KNOWLEDGE_GRAPH_GENERATION = 'knowledge_graph_generation',
}

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

const DEFAULT_MODELS: Record<WorkType, string> = {
  [WorkType.PORTAL_SUPPORT_RESPONSE]: 'gemini-2.0-flash',
  [WorkType.MEDIA_ANALYSIS]: 'gemini-2.0-flash',
  [WorkType.KNOWLEDGE_GRAPH_GENERATION]: 'gemini-2.0-flash',
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

interface AIConfig {
  geminiKey?: string;
  modelId?: string;
  models?: Partial<Record<WorkType, string>>;
}

async function resolveConfig(tenantId: string): Promise<{ apiKey: string; config: AIConfig }> {
  const policy = await prisma.policyConfig.findFirst({
    where: { tenantId, policyKey: 'ai_integrations' },
  });

  const config = (policy?.policyValue as AIConfig) ?? {};
  const apiKey = config.geminiKey || env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new ModelRouterError('AI is not configured for this tenant. Set GEMINI_API_KEY or configure ai_integrations policy.');
  }

  return { apiKey, config };
}

function resolveModel(workType: WorkType, config: AIConfig): string {
  return config.models?.[workType] ?? config.modelId ?? DEFAULT_MODELS[workType];
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
