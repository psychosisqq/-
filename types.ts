
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
    role: 'Веселый Повар',
    description: 'Звонкий, гиперактивный, с фирменным смехом.', 
    gender: 'Male',
    gradient: 'from-yellow-400 to-orange-500'
  },
  { 
    id: VoiceName.Fenrir, 
    name: 'Темный Рыцарь', 
    role: 'Герой Готэма',
    description: 'Максимально низкий бас, пафос, справедливость.', 
    gender: 'Male',
    gradient: 'from-zinc-900 to-black'
  },
  { 
    id: VoiceName.Zephyr, 
    name: 'Дэдпул', 
    role: 'Болтливый Наемник',
    description: 'Дерзкий, ломает четвертую стену, шутит.', 
    gender: 'Male',
    gradient: 'from-red-600 to-red-900'
  },
  { 
    id: VoiceName.Charon, 
    name: 'Безумный Дед', 
    role: 'Гениальный Ученый',
    description: 'Хриплый, саркастичный, рыгает в разговоре.', 
    gender: 'Male',
    gradient: 'from-emerald-400 to-cyan-600'
  },
  { 
    id: VoiceName.Kore, 
    name: 'Нейро-Тян', 
    role: 'Аниме Вайфу',
    description: 'Милый, нежный, успокаивающий голос.', 
    gender: 'Female',
    gradient: 'from-pink-400 to-rose-400'
  },
];
