
import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge', // Используем Edge Runtime для скорости
};

export default async function handler(req) {
  // Разрешаем CORS, чтобы фронтенд мог обращаться к функции
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text, voice } = await req.json();

    if (!process.env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Server API Key not configured' }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Промпт для сервера (дублируем логику, чтобы она выполнялась на бэкенде)
    const prompt = `Say the following text in Russian. Use a very funny, expressive, and energetic tone.\n\nText to speak: ${text}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find(p => p.inlineData?.data);

    if (!audioPart || !audioPart.inlineData?.data) {
      throw new Error("No audio returned from Gemini");
    }

    return new Response(JSON.stringify({ base64Audio: audioPart.inlineData.data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('API Route Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
