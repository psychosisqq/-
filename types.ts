
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
    name: 'Спанч Боб', 
    role: 'Квадратные Штаны',
    description: 'Звонкий, гиперактивный, постоянный смех (А-ха-ха!).', 
    gender: 'Male',
    gradient: 'from-yellow-400 to-orange-500'
  },
  { 
    id: VoiceName.Fenrir, 
    name: 'Бэтмен', 
    role: 'Темный Рыцарь',
    description: 'Глубокий, хриплый бас, шепот, пафос и мрак.', 
    gender: 'Male',
    gradient: 'from-zinc-900 to-black'
  },
  { 
    id: VoiceName.Zephyr, 
    name: 'Дэдпул', 
    role: 'Болтливый Наемник',
    description: 'Дерзкий, ломает четвертую стену, шутит нон-стоп.', 
    gender: 'Male',
    gradient: 'from-red-600 to-red-900'
  },
  { 
    id: VoiceName.Charon, 
    name: 'Рик Санчез', 
    role: 'Безумный Ученый',
    description: 'Саркастичный, рыгает, заикается, гениальный дед.', 
    gender: 'Male',
    gradient: 'from-emerald-400 to-cyan-600'
  },
  { 
    id: VoiceName.Kore, 
    name: 'Аниме Тян', 
    role: 'Waifu Mode',
    description: 'Милый, высокий голос, "Уву", очень эмоциональная.', 
    gender: 'Female',
    gradient: 'from-pink-400 to-rose-400'
  },
];
