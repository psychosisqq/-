import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName } from "../types";

// Initialize the client
// API Key is injected via process.env.API_KEY
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface TTSResult {
  base64Audio: string;
}

/**
 * Generates speech from text using Gemini 2.5 Flash TTS.
 */
export async function generateSpeech(
  text: string, 
  voice: VoiceName
): Promise<TTSResult> {
  const ai = getAiClient();
  
  // We incorporate the style instructions directly into the prompt.
  // Using systemInstruction with the audio modality can sometimes cause 500 errors
  // on the preview endpoints, so we put it in the user prompt.
  // We explicitly request Russian language and a funny tone.
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

    return {
      base64Audio: audioPart.inlineData.data,
    };
  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    // Provide a more user-friendly message for 500 errors
    const msg = error.message || error.toString();
    if (msg.includes("500") || msg.includes("Internal error")) {
       throw new Error("Временная ошибка сервера Gemini (500). Попробуйте чуть позже или выберите другой голос.");
    }
    throw error;
  }
}