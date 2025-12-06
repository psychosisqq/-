
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";

export interface TTSResult {
  base64Audio: string;
}

// Singleton instance to prevent re-initializing on every request
let genAIInstance: GoogleGenAI | null = null;

function getGenAIInstance(apiKey: string): GoogleGenAI {
  if (!genAIInstance) {
    genAIInstance = new GoogleGenAI({ apiKey });
  }
  return genAIInstance;
}

/**
 * Direct call to Gemini API (Client-side).
 * Used in DEV mode or as a fallback if the Proxy is unavailable (Preview mode).
 */
async function generateSpeechDirectly(text: string, voice: VoiceName): Promise<TTSResult> {
  console.log("Using Direct Client API logic...");
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key not found. Please check your .env configuration.");
  }

  const ai = getGenAIInstance(apiKey);
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
    throw error;
  }
}

/**
 * Rewrites user text to match the selected character's personality.
 * Uses Gemini 3 Pro with Thinking budget for high creativity.
 */
export async function rewriteText(text: string, voiceName: string, voiceDescription: string): Promise<string> {
   // @ts-ignore
   const isDev = import.meta.env?.DEV ?? false;
   
   // For text rewriting, we can use direct client call safely as text models are less restricted usually,
   // or simple proxy if needed. For simplicity in this demo, we use direct call since text generation
   // is standard.
   const apiKey = process.env.API_KEY;
   if (!apiKey) throw new Error("API Key missing");
   
   const ai = getGenAIInstance(apiKey);
   
   const prompt = `
     You are a creative scriptwriter. 
     Your task is to rewrite the user's text in Russian to make it funnier, more expressive, and matching a specific character persona.
     
     Character Name: ${voiceName}
     Character Description: ${voiceDescription}
     
     User Text: "${text}"
     
     Rules:
     1. Keep the meaning but change the style.
     2. Use emojis fitting the character.
     3. Keep it under 300 characters.
     4. Output ONLY the rewritten Russian text.
   `;

   try {
     const response = await ai.models.generateContent({
       model: "gemini-3-pro-preview", // Using the powerful thinking model
       contents: prompt,
       config: {
         thinkingConfig: { thinkingBudget: 32768 }, // Max thinking for creativity
       }
     });
     
     return response.text?.trim() || text;
   } catch (error) {
     console.error("Rewrite failed", error);
     return text; // Fallback to original text
   }
}

/**
 * Generates speech from text using Gemini 2.5 Flash TTS.
 */
export async function generateSpeech(
  text: string, 
  voice: VoiceName
): Promise<TTSResult> {
  
  // @ts-ignore
  const isDev = import.meta.env?.DEV ?? false;

  // 1. DEV Mode: Always use direct call for speed
  if (isDev) {
    console.log("Running in DEV mode");
    return generateSpeechDirectly(text, voice);
  }

  // 2. PROD Mode: Try Proxy first
  console.log("Running in PROD mode: Attempting /api/speech proxy");
  
  try {
    const response = await fetch('/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    // CRITICAL FIX: If 404, the API route doesn't exist (e.g. Static Preview, AI Studio).
    // Fallback to direct call immediately.
    if (response.status === 404) {
      console.warn("Proxy (/api/speech) not found (404). Switching to Direct Client API.");
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
    // If fetch failed completely (network error) or we caught a non-404 server error,
    // we try the direct method as a last resort.
    return generateSpeechDirectly(text, voice);
  }
}

function handleError(error: any) {
  console.error("Gemini TTS Error:", error);
  const msg = error.message || error.toString();
  
  if (msg.includes("500") || msg.includes("Internal error")) {
     throw new Error("Временная ошибка сервера Gemini (500). Попробуйте чуть позже или выберите другой голос.");
  }
  
  // Улучшенная обработка ошибок доступа по региону (403)
  if (msg.includes("403") || msg.includes("Location") || msg.includes("User location") || msg.includes("not supported")) {
     throw new Error("Доступ ограничен из вашего региона (ошибка 403). Попробуйте включить VPN или используйте версию сайта на Vercel (там работает встроенный прокси).");
  }
}
