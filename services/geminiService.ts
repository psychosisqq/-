
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";

export interface TTSResult {
  base64Audio: string;
}

/**
 * Generates speech from text using Gemini 2.5 Flash TTS.
 * 
 * LOGIC:
 * 1. If running locally (Development), use the Client SDK directly for speed/debug.
 * 2. If running in Production (Vercel), call the /api/speech endpoint.
 *    This acts as a proxy to bypass Geo-blocking (Russia) and hides the API key.
 */
export async function generateSpeech(
  text: string, 
  voice: VoiceName
): Promise<TTSResult> {
  
  // Проверяем, где мы находимся (Локально или на Сервере)
  const isDev = (import.meta as any).env.DEV;

  if (isDev) {
    // --- LOCAL DEVELOPMENT MODE ---
    // Работаем как раньше, напрямую с браузера
    console.log("Running in DEV mode: Calling Gemini directly");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Say the following text in Russian. Use a very funny, expressive, and energetic tone.\n\nText to speak: ${text}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
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
        throw new Error("Не удалось получить аудио от Gemini. Попробуйте еще раз.");
      }

      return { base64Audio: audioPart.inlineData.data };

    } catch (error: any) {
      handleError(error);
      throw error; // unreachable due to handleError throwing
    }
  } else {
    // --- PRODUCTION MODE (Vercel) ---
    // Звоним на свой же сервер /api/speech, чтобы он позвонил в Google
    // Это обходит блокировку в РФ
    console.log("Running in PROD mode: Calling /api/speech proxy");
    
    try {
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      return { base64Audio: data.base64Audio };

    } catch (error: any) {
      handleError(error);
      throw error;
    }
  }
}

function handleError(error: any) {
  console.error("Gemini TTS Error:", error);
  const msg = error.message || error.toString();
  if (msg.includes("500") || msg.includes("Internal error")) {
     throw new Error("Временная ошибка сервера Gemini (500). Попробуйте чуть позже или выберите другой голос.");
  }
  if (msg.includes("403") || msg.includes("Location")) {
     throw new Error("Доступ заблокирован из вашего региона. (Попробуйте обновить страницу через минуту, прокси должен сработать).");
  }
  throw error;
}