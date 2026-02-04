import type { Plugin } from 'vite';
import { loadEnv } from 'vite';

const SYSTEM_INSTRUCTION = 'You are a friendly mLab AI Support agent. Answer questions about mLab programmes, locations, applications, and events. Use simple language.';

export function apiChatPlugin(): Plugin {
  return {
    name: 'api-chat',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/chat' || req.method !== 'POST') {
          next();
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { prompt } = JSON.parse(body || '{}');
            if (!prompt || typeof prompt !== 'string') {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ text: 'Missing prompt' }));
              return;
            }
            const env = loadEnv('development', process.cwd(), '');
            const apiKey = (env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '').trim();
            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ text: 'API key not set. Add GEMINI_API_KEY to .env and restart.' }));
              return;
            }
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
              model: 'gemini-2.0-flash',
              systemInstruction: SYSTEM_INSTRUCTION
            });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ text: text || "I'm sorry, I couldn't generate a response.", latency: 0 }));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[api/chat]', err);
            const isInvalidKey = message.includes('API key not valid') || message.includes('API_KEY_INVALID');
            const text = isInvalidKey
              ? 'API key is invalid or inactive. Get a valid key at aistudio.google.com/apikey and add it to the .env file as GEMINI_API_KEY=your_key, then restart the dev server.'
              : `Error: ${message}`;
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ text }));
          }
        });
      });
    }
  };
}
