export enum VoiceName {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr',
}

export interface VoiceOption {
  id: VoiceName;
  name: string;
  description: string;
  gender: 'Male' | 'Female';
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: VoiceName.Puck, name: 'Пак (Puck)', description: 'Игривый и озорной (Смешной)', gender: 'Male' },
  { id: VoiceName.Fenrir, name: 'Фенрир (Fenrir)', description: 'Глубокий и грозный', gender: 'Male' },
  { id: VoiceName.Kore, name: 'Кора (Kore)', description: 'Спокойный женский', gender: 'Female' },
  { id: VoiceName.Zephyr, name: 'Зефир (Zephyr)', description: 'Мягкий мужской', gender: 'Male' },
  { id: VoiceName.Charon, name: 'Харон (Charon)', description: 'Низкий и уверенный', gender: 'Male' },
];