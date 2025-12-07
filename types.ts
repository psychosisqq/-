
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
  gradient: string; 
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { 
    id: VoiceName.Puck, 
    name: 'Puck', 
    role: 'Игривый',
    description: 'Энергичный, слегка высокий тембр. Хорошо подходит для эмоциональных текстов.', 
    gender: 'Male',
    gradient: 'from-indigo-400 to-blue-500'
  },
  { 
    id: VoiceName.Fenrir, 
    name: 'Fenrir', 
    role: 'Глубокий',
    description: 'Самый низкий и мощный бас. Звучит серьезно и авторитетно.', 
    gender: 'Male',
    gradient: 'from-slate-700 to-slate-900'
  },
  { 
    id: VoiceName.Zephyr, 
    name: 'Zephyr', 
    role: 'Спокойный',
    description: 'Сбалансированный мужской голос. Идеален для чтения новостей и рассказов.', 
    gender: 'Male',
    gradient: 'from-emerald-500 to-teal-600'
  },
  { 
    id: VoiceName.Charon, 
    name: 'Charon', 
    role: 'Уверенный',
    description: 'Насыщенный тембр, подходящий для подкастов и профессиональной озвучки.', 
    gender: 'Male',
    gradient: 'from-violet-500 to-purple-600'
  },
  { 
    id: VoiceName.Kore, 
    name: 'Kore', 
    role: 'Женский',
    description: 'Мягкий и естественный женский голос. Звучит тепло и расслабляюще.', 
    gender: 'Female',
    gradient: 'from-pink-400 to-rose-400'
  },
];