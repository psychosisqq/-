
import React, { useState, useRef, useEffect } from 'react';
import { generateSpeech } from './services/geminiService';
import { VoiceName, VOICE_OPTIONS } from './types';
import { decodeAudioData, createWavBlob } from './utils/audio';
import AudioVisualizer from './components/AudioVisualizer';
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
  ArrowPathIcon
} from '@heroicons/react/24/solid';

interface HistoryItem {
  id: string;
  text: string;
  voice: VoiceName;
  audioBase64: string;
  timestamp: number;
}

const App: React.FC = () => {
  // State
  const [text, setText] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Puck);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
  // We call this on input focus to "pre-warm" the audio engine.
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new Ctx({ sampleRate: 24000 });
      analyserRef.current = audioContextRef.current!.createAnalyser();
      analyserRef.current.fftSize = 256;
    }
    // Browsers require a user gesture to resume 'suspended' contexts.
    // Focusing the input counts as a gesture.
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(e => console.debug("Audio resume failed (expected if no interaction)", e));
    }
  };

  const handleGenerate = async () => {
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
      
      if (audioContextRef.current) {
        const buffer = await decodeAudioData(base64Audio, audioContextRef.current);
        audioBufferRef.current = buffer;
        playAudio(buffer);

        // Add to history
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          text: text,
          voice: selectedVoice,
          audioBase64: base64Audio,
          timestamp: Date.now()
        };
        setHistory(prev => [newItem, ...prev].slice(0, 10)); // Keep last 10
      }
    } catch (err: any) {
      setError(err.message || "Ошибка при генерации аудио");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (base64Data: string, voiceName: string) => {
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
    if (isPlaying) {
      // Pause
      if (sourceRef.current && audioContextRef.current) {
        // Calculate paused position considering playback rate
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        pausedAtRef.current = elapsed * playbackRate;
        
        sourceRef.current.stop();
        sourceRef.current = null;
        setIsPlaying(false);
      }
    } else {
      // Resume
      if (audioBufferRef.current) {
        initAudioContext();
        playAudio(audioBufferRef.current);
      }
    }
  };

  const loadFromHistory = async (item: HistoryItem) => {
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
    setHistory(prev => prev.filter(item => item.id !== id));
  };

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
            onClick={() => setIsDarkMode(!isDarkMode)}
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

      <div className="max-w-4xl w-full bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700 transition-colors duration-300 mb-8">
        <div className="p-6 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Input & Controls */}
          <div className="space-y-6">
            
            {/* Voice Selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Выберите голос
              </label>
              <div className="grid grid-cols-1 gap-3">
                {VOICE_OPTIONS.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      selectedVoice === voice.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 shadow-sm'
                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        selectedVoice === voice.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300'
                      }`}>
                         {voice.name[0]}
                      </div>
                      <div>
                        <div className={`font-semibold text-sm ${selectedVoice === voice.id ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-900 dark:text-slate-100'}`}>
                          {voice.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {voice.description}
                        </div>
                      </div>
                    </div>
                    {selectedVoice === voice.id && (
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Input */}
            <div>
              <label htmlFor="text-input" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Ваш текст (на русском)
              </label>
              <div className="relative">
                <textarea
                  id="text-input"
                  rows={5}
                  className="block w-full rounded-xl border-slate-300 dark:border-slate-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-4 resize-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400"
                  placeholder="Например: Привет! Я твой новый голосовой помощник, и я люблю печеньки."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={initAudioContext} // Pre-warm AudioContext on focus
                />
                <div className="absolute bottom-2 right-2">
                  <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-slate-300 dark:text-slate-500" />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 text-right">
                {text.length} символов
              </p>
            </div>
            
             {/* Generate Button */}
             <button
              onClick={handleGenerate}
              disabled={isLoading || !text.trim()}
              className={`w-full flex items-center justify-center py-4 px-6 border border-transparent rounded-xl shadow-md text-base font-bold text-white transition-all transform active:scale-95 ${
                isLoading || !text.trim()
                  ? 'bg-indigo-300 dark:bg-indigo-800 cursor-not-allowed'
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

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-300 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Visualization & Playback */}
          <div className="flex flex-col justify-center space-y-6 bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 transition-colors duration-300">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <SpeakerWaveIcon className="h-5 w-5 text-indigo-500" />
              Плеер
            </h3>
            
            <AudioVisualizer 
              analyser={analyserRef.current} 
              isPlaying={isPlaying} 
            />

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
             {!audioBufferRef.current && isLoading && (
                <div className="text-center text-sm text-indigo-400 dark:text-indigo-300 py-4 animate-pulse">
                    Нейросеть генерирует голос...
                </div>
            )}
          </div>

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
        Powered by Google Gemini 2.5 Flash TTS
      </div>
    </div>
  );
};

export default App;
