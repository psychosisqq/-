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
  role: string;
  description: string;
  gender: 'Male' | 'Female';
  gradient: string; // CSS class for avatar gradient
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { 
    id: VoiceName.Puck, 
    name: 'Макс Ветров', 
    role: 'Стример / Блогер',
    description: 'Энергичный, быстрый, с ноткой хайпа.', 
    gender: 'Male',
    gradient: 'from-orange-500 to-yellow-500'
  },
  { 
    id: VoiceName.Fenrir, 
    name: 'Борис "Скала"', 
    role: 'Начальник охраны',
    description: 'Глубокий бас, уверенный, угрожающий.', 
    gender: 'Male',
    gradient: 'from-slate-900 to-slate-700'
  },
  { 
    id: VoiceName.Kore, 
    name: 'Елена Тихая', 
    role: 'Психолог / ASMR',
    description: 'Мягкий, успокаивающий, доверительный.', 
    gender: 'Female',
    gradient: 'from-rose-400 to-pink-600'
  },
  { 
    id: VoiceName.Zephyr, 
    name: 'Артур Пирожков', 
    role: 'Шоумен',
    description: 'Харизматичный, поставленный голос.', 
    gender: 'Male',
    gradient: 'from-blue-500 to-cyan-400'
  },
  { 
    id: VoiceName.Charon, 
    name: 'Профессор Громов', 
    role: 'Лектор',
    description: 'Низкий, хриплый, авторитетный.', 
    gender: 'Male',
    gradient: 'from-emerald-600 to-teal-900'
  },
];