
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";

export interface TTSResult {
  base64Audio: string;
}

let genAIInstance: GoogleGenAI | null = null;

function getGenAIInstance(apiKey: string): GoogleGenAI {
  if (!genAIInstance) {
    genAIInstance = new GoogleGenAI({ apiKey });
  }
  return genAIInstance;
}

/**
 * Direct call to Gemini API (Client-side).
 */
async function generateSpeechDirectly(text: string, voice: VoiceName): Promise<TTSResult> {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key not found. Please check your .env configuration.");
  }

  const ai = getGenAIInstance(apiKey);
  
  // Clean request: Just text and voice config.
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
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
    throw error;
  }
}

/**
 * Rewrites user text to match the selected voice style implicitly.
 */
export async function rewriteText(text: string, voiceName: string, voiceDescription: string): Promise<string> {
   // @ts-ignore
   const isDev = import.meta.env?.DEV ?? false;
   
   const apiKey = process.env.API_KEY;
   if (!apiKey) throw new Error("API Key missing");
   
   const ai = getGenAIInstance(apiKey);
   
   // Generic prompt focusing on the voice characteristics rather than a persona
   const prompt = `
     Перепиши следующий текст на русском языке, чтобы он звучал максимально естественно и выразительно.
     
     Контекст стиля голоса: ${voiceDescription} (Имя голоса: ${voiceName})
     Оригинальный текст: "${text}"
     
     Задача:
     1. Сохрани смысл оригинального текста.
     2. Адаптируй структуру предложений под описание голоса (например, для серьезного голоса - более весомые фразы, для игривого - более легкие).
     3. Добавь (в умеренных количествах) знаки препинания для пауз, чтобы TTS модель прочитала это с правильной интонацией.
     
     Верни ТОЛЬКО переписанный текст без кавычек и комментариев.
   `;

   try {
     const response = await ai.models.generateContent({
       model: "gemini-3-pro-preview", 
       contents: prompt,
       config: {
         thinkingConfig: { thinkingBudget: 1024 }, 
       }
     });
     
     return response.text?.trim() || text;
   } catch (error) {
     console.error("Rewrite failed", error);
     return text; 
   }
}

export async function generateSpeech(
  text: string, 
  voice: VoiceName
): Promise<TTSResult> {
  
  // @ts-ignore
  const isDev = import.meta.env?.DEV ?? false;

  if (isDev) {
    return generateSpeechDirectly(text, voice);
  }

  try {
    const response = await fetch('/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    if (response.status === 404) {
      return generateSpeechDirectly(text, voice);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    return { base64Audio: data.base64Audio };

  } catch (error: any) {
    console.warn("Proxy request failed. Fallback to Direct API logic.", error);
    return generateSpeechDirectly(text, voice);
  }
}

function handleError(error: any) {
  console.error("Gemini TTS Error:", error);
  const msg = error.message || error.toString();
  
  if (msg.includes("500") || msg.includes("Internal error")) {
     throw new Error("Временная ошибка сервера Gemini. Попробуйте другой голос.");
  }
  
  if (msg.includes("403") || msg.includes("Location")) {
     throw new Error("Ошибка доступа (регион). Попробуйте VPN.");
  }
}