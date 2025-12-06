
import React, { useState, useRef, useEffect } from 'react';
import { generateSpeech, rewriteText } from './services/geminiService';
import { VoiceName, VOICE_OPTIONS } from './types';
import { decodeAudioData, createWavBlob } from './utils/audio';
import AudioVisualizer from './components/AudioVisualizer';
import { playClickSound, playSuccessSound, playDownloadSound, playDeleteSound } from './utils/soundEffects';
import { 
  PlayIcon, 
  PauseIcon, 
  SpeakerWaveIcon, 
  SparklesIcon, 
  ChatBubbleBottomCenterTextIcon,
  MoonIcon,
  SunIcon,
  ArrowDownTrayIcon,
  DevicePhoneMobileIcon,
  BoltIcon,
  ClockIcon,
  TrashIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/solid';

// Visual mapping for voices to make them feel like characters
const VOICE_META: Record<VoiceName, { emoji: string }> = {
  [VoiceName.Puck]: { emoji: '🤡' },
  [VoiceName.Charon]: { emoji: '🗿' },
  [VoiceName.Kore]: { emoji: '🌺' },
  [VoiceName.Fenrir]: { emoji: '🐺' },
  [VoiceName.Zephyr]: { emoji: '🍃' },
};

interface HistoryItem {
  id: string;
  text: string;
  voice: VoiceName;
  audioBase64: string;
  timestamp: number;
}

const MAX_CHARS = 500;

const App: React.FC = () => {
  // State
  const [text, setText] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Puck);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRewriting, setIsRewriting] = useState<boolean>(false); // State for AI Rewrite
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // Dark Mode State with initialization from localStorage
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) {
        return JSON.parse(saved);
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  // Capture PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    playClickSound();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  // Apply dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Update playback rate dynamically if playing
  useEffect(() => {
    if (sourceRef.current && isPlaying) {
      sourceRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate, isPlaying]);

  // Initializes or resumes the AudioContext.
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new Ctx({ sampleRate: 24000 });
      analyserRef.current = audioContextRef.current!.createAnalyser();
      analyserRef.current.fftSize = 256;
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(e => console.debug("Audio resume failed", e));
    }
  };

  const handleRewrite = async () => {
    playClickSound();
    if (!text.trim()) return;
    
    setIsRewriting(true);
    try {
      const voiceInfo = VOICE_OPTIONS.find(v => v.id === selectedVoice);
      const newText = await rewriteText(text, voiceInfo?.name || 'Character', voiceInfo?.description || 'Funny');
      setText(newText);
      playSuccessSound();
    } catch (e) {
      console.error(e);
      // Fail silently or show small toast, but don't break flow
    } finally {
      setIsRewriting(false);
    }
  };

  const handleClearText = () => {
    playDeleteSound();
    setText('');
    setAudioBase64(null);
    audioBufferRef.current = null;
    stopAudio();
  };

  const handlePasteText = async () => {
    playClickSound();
    try {
      const clipboardText = await navigator.clipboard.readText();
      setText(clipboardText.slice(0, MAX_CHARS));
    } catch (e) {
      console.error("Clipboard access denied");
    }
  };

  const handleGenerate = async () => {
    playClickSound();
    if (!text.trim()) return;
    
    setIsLoading(true);
    setError(null);
    stopAudio();
    audioBufferRef.current = null;
    setAudioBase64(null);

    try {
      initAudioContext();
      
      const { base64Audio } = await generateSpeech(text, selectedVoice);
      setAudioBase64(base64Audio);
      playSuccessSound();
      
      if (audioContextRef.current) {
        const buffer = await decodeAudioData(base64Audio, audioContextRef.current);
        audioBufferRef.current = buffer;
        playAudio(buffer);

        const newItem: HistoryItem = {
          id: Date.now().toString(),
          text: text,
          voice: selectedVoice,
          audioBase64: base64Audio,
          timestamp: Date.now()
        };
        setHistory(prev => [newItem, ...prev].slice(0, 10));
      }
    } catch (err: any) {
      setError(err.message || "Ошибка при генерации аудио");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (base64Data: string, voiceName: string) => {
    playDownloadSound();
    if (!base64Data) return;
    
    const wavBlob = createWavBlob(base64Data);
    const url = URL.createObjectURL(wavBlob);
    
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `funny-voice-${voiceName}-${timestamp}.wav`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const playAudio = (buffer: AudioBuffer) => {
    if (!audioContextRef.current || !analyserRef.current) return;

    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.connect(analyserRef.current);
    analyserRef.current.connect(audioContextRef.current.destination);

    const offset = pausedAtRef.current;
    
    source.start(0, offset);
    startTimeRef.current = audioContextRef.current.currentTime - (offset / playbackRate);
    
    sourceRef.current = source;
    setIsPlaying(true);
  };

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {}
      sourceRef.current = null;
    }
    setIsPlaying(false);
    pausedAtRef.current = 0;
  };

  const togglePlayback = () => {
    playClickSound();
    if (isPlaying) {
      if (sourceRef.current && audioContextRef.current) {
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        pausedAtRef.current = elapsed * playbackRate;
        
        sourceRef.current.stop();
        sourceRef.current = null;
        setIsPlaying(false);
      }
    } else {
      if (audioBufferRef.current) {
        initAudioContext();
        playAudio(audioBufferRef.current);
      }
    }
  };

  const loadFromHistory = async (item: HistoryItem) => {
    playClickSound();
    stopAudio();
    setText(item.text);
    setSelectedVoice(item.voice);
    setAudioBase64(item.audioBase64);
    
    try {
      initAudioContext();
      if (audioContextRef.current) {
        const buffer = await decodeAudioData(item.audioBase64, audioContextRef.current);
        audioBufferRef.current = buffer;
        playAudio(buffer);
      }
    } catch (e) {
      console.error("Failed to load history item", e);
    }
  };

  const deleteFromHistory = (id: string) => {
    playDeleteSound();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleVoiceSelect = (id: VoiceName) => {
    playClickSound();
    setSelectedVoice(id);
  }

  const handleThemeToggle = () => {
    playClickSound();
    setIsDarkMode(!isDarkMode);
  }

  useEffect(() => {
     if(!isPlaying) return;
     
     const checkEnded = setInterval(() => {
         if (audioContextRef.current && startTimeRef.current && audioBufferRef.current) {
             const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * playbackRate;
             if (elapsed >= audioBufferRef.current.duration) {
                 setIsPlaying(false);
                 pausedAtRef.current = 0;
             }
         }
     }, 200);
     return () => clearInterval(checkEnded);
  }, [isPlaying, playbackRate]);

  // Determine if player controls should be visible
  const showPlayer = !!audioBase64 || isLoading;

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      
      {/* Header */}
      <div className="relative max-w-3xl w-full text-center mb-10">
        
        <div className="absolute right-0 top-0 flex items-center gap-2">
           {deferredPrompt && (
            <button 
              onClick={handleInstallClick}
              className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all animate-bounce"
              title="Установить приложение"
            >
              <DevicePhoneMobileIcon className="h-6 w-6" />
            </button>
          )}

          <button 
            onClick={handleThemeToggle}
            className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
            title={isDarkMode ? "Светлая тема" : "Тёмная тема"}
          >
            {isDarkMode ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
          </button>
        </div>

        <div className="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-full shadow-lg mb-4">
            <SpeakerWaveIcon className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight sm:text-5xl mb-2">
          Смешная Озвучка
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Напишите текст, выберите персонажа, и нейросеть озвучит его!
        </p>
      </div>

      <div className={`w-full bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700 transition-all duration-500 ease-in-out mb-8 ${showPlayer ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className={`p-6 sm:p-10 grid gap-8 transition-all duration-500 ${showPlayer ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          
          {/* Left Column: Input & Controls */}
          <div className="space-y-6">
            
            {/* Voice Selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Выберите персонажа
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {VOICE_OPTIONS.map((voice) => {
                  const meta = VOICE_META[voice.id];
                  const isSelected = selectedVoice === voice.id;
                  return (
                    <button
                      key={voice.id}
                      onClick={() => handleVoiceSelect(voice.id)}
                      className={`relative flex flex-col items-center p-3 rounded-2xl border-2 transition-all duration-200 text-center group ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-400 shadow-md transform scale-[1.02]'
                          : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-200 dark:hover:border-slate-600 hover:shadow-lg'
                      }`}
                    >
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full mb-2 flex items-center justify-center text-xl sm:text-2xl shadow-sm transition-all duration-300 ${
                         isSelected 
                           ? 'bg-indigo-500 text-white scale-110' 
                           : 'bg-slate-100 dark:bg-slate-700 text-slate-500 grayscale group-hover:grayscale-0 group-hover:scale-105'
                      }`}>
                         {meta.emoji}
                      </div>
                      <div className={`font-bold text-sm leading-tight ${isSelected ? 'text-indigo-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                        {voice.name.split(' (')[0]}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-1 line-clamp-2 px-1">
                         {voice.description}
                      </div>
                      
                      {isSelected && (
                         <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Text Input */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="text-input" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Ваш текст
                </label>
                <div className="flex gap-2">
                  {/* Text Tools */}
                   <button 
                     onClick={handleClearText}
                     disabled={text.length === 0}
                     className={`text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded-md ${
                        text.length === 0 
                        ? 'text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800 cursor-not-allowed'
                        : 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40'
                     }`}
                     title="Очистить всё"
                   >
                     <TrashIcon className="h-3 w-3" /> Очистить
                   </button>
                  <button 
                    onClick={handlePasteText}
                    className="text-xs text-slate-400 hover:text-indigo-500 flex items-center gap-1 transition-colors px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md"
                    title="Вставить из буфера"
                  >
                    <ClipboardDocumentIcon className="h-3 w-3" /> Вставить
                  </button>
                </div>
              </div>

              <div className="relative group">
                <textarea
                  id="text-input"
                  rows={5}
                  maxLength={MAX_CHARS}
                  className={`block w-full rounded-xl border-slate-300 dark:border-slate-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-4 resize-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 transition-colors ${isRewriting ? 'opacity-50' : ''}`}
                  placeholder="Например: Привет! Я твой новый голосовой помощник..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={initAudioContext}
                  disabled={isRewriting || isLoading}
                />
                
                {/* Magic Rewrite Button */}
                <button
                  onClick={handleRewrite}
                  disabled={!text.trim() || isRewriting || isLoading}
                  className="absolute bottom-3 left-3 p-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all disabled:opacity-0 disabled:pointer-events-none"
                  title="Улучшить текст в стиле персонажа (AI)"
                >
                  {isRewriting ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <div className="flex items-center gap-1">
                      <WrenchScrewdriverIcon className="h-4 w-4" />
                      <span className="text-xs font-bold">Стиль</span>
                    </div>
                  )}
                </button>

                <div className="absolute bottom-2 right-2 pointer-events-none">
                  <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-slate-300 dark:text-slate-500 opacity-20" />
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                 <p className="text-xs text-indigo-500/80 dark:text-indigo-400/80 h-4">
                   {isRewriting && "Нейросеть придумывает шутку..."}
                 </p>
                 <p className={`text-xs ${text.length > MAX_CHARS * 0.9 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                  {text.length} / {MAX_CHARS}
                </p>
              </div>
            </div>
            
             {/* Generate Button */}
             <div className="relative">
               {isLoading && (
                 <div className="absolute -inset-1 bg-indigo-500 rounded-xl blur opacity-25 animate-pulse"></div>
               )}
               <button
                onClick={handleGenerate}
                disabled={isLoading || !text.trim() || isRewriting}
                className={`relative w-full flex items-center justify-center py-4 px-6 border border-transparent rounded-xl shadow-md text-base font-bold text-white transition-all transform active:scale-95 ${
                  isLoading || !text.trim() || isRewriting
                    ? 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg dark:bg-indigo-600 dark:hover:bg-indigo-500'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Создаю магию...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    Озвучить Текст
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-300 text-sm animate-fade-in">
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Visualization & Playback */}
          {showPlayer && (
            <div className="flex flex-col justify-center space-y-6 bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 transition-colors duration-300">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <SpeakerWaveIcon className="h-5 w-5 text-indigo-500" />
                Плеер
              </h3>
              
              {/* Visualizer Container */}
              <div className="relative">
                <AudioVisualizer 
                  analyser={analyserRef.current} 
                  isPlaying={isPlaying} 
                />
                
                {/* Animated Loading Overlay */}
                {!audioBufferRef.current && isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/50 dark:bg-slate-800/50 rounded-xl backdrop-blur-sm z-10">
                      <div className="flex gap-1.5 items-end h-8 mb-3">
                          {[...Array(5)].map((_, i) => (
                              <div 
                                key={i} 
                                className="w-1.5 bg-indigo-500 rounded-full animate-bounce" 
                                style={{ height: '60%', animationDelay: `${i * 0.1}s` }}
                              ></div>
                          ))}
                      </div>
                      <div className="text-sm text-indigo-600 dark:text-indigo-300 font-semibold animate-pulse">
                          Генерирую озвучку...
                      </div>
                  </div>
                )}
              </div>

              {/* Speed Control Slider */}
              <div className="w-full px-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <BoltIcon className="h-4 w-4" />
                    Скорость и Тон
                  </label>
                  <span className="text-xs font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                    {playbackRate.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium uppercase tracking-wider">
                  <span>Монстр</span>
                  <span>Норма</span>
                  <span>Бурундук</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 mt-2">
                {/* Controls Row */}
                <div className="flex items-center gap-6">
                  {/* Custom Play Button */}
                  <button 
                    onClick={togglePlayback}
                    disabled={!audioBufferRef.current}
                    className={`h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                        !audioBufferRef.current 
                            ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed' 
                            : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:shadow-indigo-500/50'
                    }`}
                    aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
                  >
                    {isPlaying ? (
                        <PauseIcon className="h-8 w-8" />
                    ) : (
                        <PlayIcon className="h-8 w-8 ml-1" />
                    )}
                  </button>

                  {/* Download Button */}
                  {audioBase64 && (
                    <button
                      onClick={() => handleDownload(audioBase64, selectedVoice)}
                      className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-600 transition-all shadow-md"
                      title="Скачать WAV"
                      aria-label="Скачать аудио"
                    >
                      <ArrowDownTrayIcon className="h-6 w-6" />
                    </button>
                  )}
                </div>
              </div>
              
              {!audioBufferRef.current && !isLoading && (
                  <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">
                      Аудио пока нет. Напишите текст и нажмите "Озвучить".
                  </div>
              )}
            </div>
          )}

        </div>
      </div>
      
      {/* History Section */}
      {history.length > 0 && (
        <div className="max-w-4xl w-full mb-10 px-2">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <ClockIcon className="h-6 w-6 text-indigo-500" />
            История (Последние {history.length})
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {history.map((item) => (
              <div 
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
                      {item.voice}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm truncate pr-4" title={item.text}>
                    {item.text}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button 
                    onClick={() => loadFromHistory(item)}
                    className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    title="Воспроизвести в плеере"
                  >
                    <ArrowPathIcon className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => handleDownload(item.audioBase64, item.voice)}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    title="Скачать"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => deleteFromHistory(item.id)}
                    className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    title="Удалить"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 text-center text-slate-400 dark:text-slate-500 text-sm">
        Powered by Google Gemini 2.5 Flash TTS & Gemini 3.0 Pro
      </div>
    </div>
  );
};

export default App;
