import { GoogleGenerativeAI } from "@google/generative-ai";

function getApiKey(): string {
  const key = (
    (typeof import.meta !== 'undefined' && (import.meta.env as Record<string, string>)?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta.env as Record<string, string>)?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.API_KEY) ||
    ''
  ).trim();
  return key;
}

const MODEL = 'gemini-2.0-flash';

class LLMProvider {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = getApiKey();
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async generateResponse(prompt: string): Promise<{ text: string; latency: number }> {
    const start = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        text: "API key not set. Add GEMINI_API_KEY to a .env file in the project root and restart the dev server (Ctrl+C then npm run dev).",
        latency: Date.now() - start
      };
    }
    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    try {
      const model = this.genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: "You are a friendly mLab AI Support agent. Answer questions about mLab programmes, locations, applications, and events. Use simple language."
      });
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      return {
        text: text || "I'm sorry, I couldn't generate a response. Would you like to speak to an agent?",
        latency: Date.now() - start
      };
    } catch (err: unknown) {
      const error = err as { message?: string; status?: number };
      const msg = error?.message ?? String(err);
      console.error("LLM Error:", err);
      const userMsg = msg.includes('API_KEY') || msg.includes('API key')
        ? "API key invalid or missing. Check your .env file and restart the dev server."
        : msg.includes('quota') || msg.includes('429')
          ? "Rate limit exceeded. Please try again in a moment."
          : msg.includes('403') || msg.includes('PERMISSION')
            ? "Permission denied. Check that your API key is valid and has Gemini API access."
            : `Error connecting to AI service. Please try again. (${msg.slice(0, 80)}${msg.length > 80 ? '…' : ''})`;
      return {
        text: userMsg,
        latency: Date.now() - start
      };
    }
  }
}

export const llmProvider = new LLMProvider();
