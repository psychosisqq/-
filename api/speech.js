
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60, // Увеличиваем время на обработку до 60 секунд
};

// Используем стандартный Node.js обработчик (req, res)
export default async function handler(req, res) {
  // Настройка CORS (чтобы браузер не ругался)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Если это предварительный запрос (OPTIONS) - просто отвечаем ОК
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Разрешаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // В Node.js (Vercel) req.body уже распарсен, если заголовок application/json
    const { text, voice } = req.body;

    if (!process.env.API_KEY) {
      console.error("Сервер: API Key не найден!");
      return res.status(500).json({ error: 'Server API Key not configured' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Промпт для генерации
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

    // Возвращаем аудио клиенту
    return res.status(200).json({ base64Audio: audioPart.inlineData.data });

  } catch (error) {
    console.error('API Route Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
