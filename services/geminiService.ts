
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

// Specific prompts to force Gemini TTS to adopt the character's prosody
const VOICE_PROMPTS: Record<string, string> = {
  [VoiceName.Puck]: 'Say the following in Russian. You are SpongeBob SquarePants. Tone: High-pitched, ecstatic, very fast, laughing frequently (Ah-ha-ha!).',
  [VoiceName.Fenrir]: 'Say the following in Russian. You are Batman. Tone: Very deep, gravelly, slow, serious, whispering intensity.',
  [VoiceName.Zephyr]: 'Say the following in Russian. You are Deadpool. Tone: Sarcastic, edgy, playful, varying pitch, breaking the fourth wall.',
  [VoiceName.Charon]: 'Say the following in Russian. You are Rick Sanchez. Tone: Raspy, manic, stuttering, belching, condescending, scientific.',
  [VoiceName.Kore]: 'Say the following in Russian. You are a sweet Anime Girl. Tone: Very high-pitched, breathy, cute, uwu style, excited.',
};

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
  
  // Construct a prompt that forces the specific character persona
  const styleInstruction = VOICE_PROMPTS[voice] || 'Say the following text in Russian. Use a very funny, expressive, and energetic tone.';
  const prompt = `${styleInstruction}\n\nText to speak: "${text}"`;

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
   
   const apiKey = process.env.API_KEY;
   if (!apiKey) throw new Error("API Key missing");
   
   const ai = getGenAIInstance(apiKey);
   
   const prompt = `
     You are a professional scriptwriter and parodist.
     Your task is to rewrite the user's text in Russian to sound EXACTLY like a specific pop-culture character.
     
     Character Name: ${voiceName}
     Character Description: ${voiceDescription}
     
     User Text: "${text}"
     
     Instructions:
     1. Adopt the character's vocabulary, catchphrases, and mannerisms.
     2. If it's SpongeBob, add enthusiastic laughing (А-ха-ха!) and nautical terms.
     3. If it's Batman/Dark Knight, make it gritty, dark, and overly dramatic.
     4. If it's Deadpool, break the fourth wall, be sarcastic and edgy.
     5. If it's Rick/Mad Scientist, stutter slightly, maybe add a burp (*рыг*), and sound superior.
     6. Keep the core meaning of the user's text, but completely change the style.
     7. Output ONLY the rewritten Russian text.
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
  
  if (msg.includes("403") || msg.includes("Location") || msg.includes("User location") || msg.includes("not supported")) {
     throw new Error("Доступ ограничен из вашего региона (ошибка 403). Попробуйте включить VPN или используйте версию сайта на Vercel.");
  }
}
