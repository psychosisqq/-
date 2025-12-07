
import React, { useState, useRef, useEffect } from 'react';
import { generateSpeech, rewriteText } from './services/geminiService';
import { VoiceName, VOICE_OPTIONS } from './types';
import { decodeAudioData, createWavBlob } from './utils/audio';
import AudioVisualizer from './components/AudioVisualizer';
import { playClickSound, playSuccessSound, playDownloadSound, playDeleteSound } from './utils/soundEffects';
import { 
  PlayIcon, 
  PauseIcon, 
  SparklesIcon, 
  ArrowDownTrayIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  WrenchScrewdriverIcon,
  InformationCircleIcon
} from '@heroicons/react/24/solid';

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2);

interface HistoryItem {
  id: string;
  text: string;
  voice: VoiceName;
  audioBase64: string;
  timestamp: number;
}

const MAX_CHARS = 500;

const App: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Puck);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRewriting, setIsRewriting] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [voicePlaying, setVoicePlaying] = useState<VoiceName | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    if (sourceRef.current && isPlaying) {
      sourceRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate, isPlaying]);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new Ctx({ sampleRate: 24000 });
      analyserRef.current = audioContextRef.current!.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.7;
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  };

  const handleRewrite = async () => {
    playClickSound();
    if (!text.trim()) return;
    setIsRewriting(true);
    try {
      const voiceInfo = VOICE_OPTIONS.find(v => v.id === selectedVoice);
      const newText = await rewriteText(text, voiceInfo?.name || '', voiceInfo?.description || '');
      setText(newText);
      playSuccessSound();
    } catch (e) { console.error(e); } 
    finally { setIsRewriting(false); }
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
    } catch (e) { console.error("Clipboard error", e); }
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
      setError(err.message || "Ошибка генерации");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoicePreview = async (e: React.MouseEvent, voice: VoiceName) => {
      e.stopPropagation();
      if (voicePlaying) return;
      playClickSound();
      setVoicePlaying(voice);
      try {
          initAudioContext();
          const voiceInfo = VOICE_OPTIONS.find(v => v.id === voice);
          const previewText = voiceInfo ? `Проверка голоса ${voiceInfo.name}.` : "Проверка.";
          const { base64Audio } = await generateSpeech(previewText, voice);
          if (audioContextRef.current) {
              const buffer = await decodeAudioData(base64Audio, audioContextRef.current);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(audioContextRef.current.destination);
              source.start();
              source.onended = () => setVoicePlaying(null);
          }
      } catch (e) {
          setVoicePlaying(null);
      }
  };

  const handleDownload = (base64Data: string, voiceName: string, format: 'wav' | 'json') => {
    playDownloadSound();
    const voiceInfo = VOICE_OPTIONS.find(v => v.id === voiceName);
    const fileName = `voice-${voiceInfo?.name.replace(/\s/g, '_') || 'audio'}-${Date.now()}`;

    if (format === 'wav') {
        const wavBlob = createWavBlob(base64Data);
        const url = URL.createObjectURL(wavBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        const jsonBlob = new Blob([JSON.stringify({ voice: voiceName, audio: base64Data })], { type: 'application/json' });
        const url = URL.createObjectURL(jsonBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
  };

  const playAudio = (buffer: AudioBuffer) => {
    if (!audioContextRef.current || !analyserRef.current) return;
    if (sourceRef.current) sourceRef.current.disconnect();

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
      try { sourceRef.current.stop(); } catch (e) {}
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
        stopAudio();
      }
    } else {
      if (audioBufferRef.current) {
        initAudioContext();
        playAudio(audioBufferRef.current);
      }
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    playClickSound();
    stopAudio();
    setText(item.text);
    setSelectedVoice(item.voice);
    setAudioBase64(item.audioBase64);
    
    initAudioContext();
    if (audioContextRef.current) {
       decodeAudioData(item.audioBase64, audioContextRef.current).then(buffer => {
           audioBufferRef.current = buffer;
           playAudio(buffer);
       });
    }
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
     }, 100);
     return () => clearInterval(checkEnded);
  }, [isPlaying, playbackRate]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-400 font-sans selection:bg-indigo-500/20 selection:text-indigo-200 flex flex-col">
      
      {/* Header */}
      <header className="w-full border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className="text-white font-bold tracking-tight text-lg">AI Studio</div>
                  <div className="h-4 w-[1px] bg-zinc-800"></div>
                  <div className="text-xs font-mono text-zinc-500">VOICE GEN v2.2</div>
              </div>
          </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Panel */}
        <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Voice Selector */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Выбор голоса</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {VOICE_OPTIONS.map((voice) => {
                        const isSelected = selectedVoice === voice.id;
                        return (
                            <div 
                                key={voice.id}
                                onClick={() => { playClickSound(); setSelectedVoice(voice.id); }}
                                className={`group relative cursor-pointer rounded-lg p-3 border transition-all duration-200 flex items-start gap-4 ${
                                    isSelected 
                                    ? 'bg-zinc-900 border-indigo-500/50 shadow-md shadow-indigo-900/10' 
                                    : 'bg-zinc-900/30 border-white/5 hover:bg-zinc-900 hover:border-zinc-700'
                                }`}
                            >
                                <div className={`h-10 w-10 shrink-0 rounded-full bg-gradient-to-br ${voice.gradient} flex items-center justify-center text-white text-xs font-bold shadow-inner`}>
                                    {getInitials(voice.name)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                            {voice.name}
                                        </h3>
                                        <button
                                            onClick={(e) => handleVoicePreview(e, voice.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                                            title="Слушать демо"
                                        >
                                            {voicePlaying === voice.id ? 
                                                <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"/> : 
                                                <PlayIcon className="h-3 w-3 text-zinc-400"/>
                                            }
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-0.5">{voice.role}</p>
                                    <p className="text-[10px] text-zinc-600 line-clamp-2 leading-tight">{voice.description}</p>
                                </div>
                                
                                {isSelected && (
                                    <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* Script Input */}
            <section className="flex-1 flex flex-col gap-3 min-h-[280px]">
                 <div className="flex justify-between items-end px-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Сценарий</label>
                    <div className="flex gap-2">
                        <button onClick={handlePasteText} className="px-2 py-1 rounded hover:bg-white/5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5">
                            <ClipboardDocumentIcon className="h-3 w-3"/> Вставить
                        </button>
                        <button 
                            onClick={handleClearText}
                            disabled={!text} 
                            className="px-2 py-1 rounded hover:bg-red-500/10 text-[10px] text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1.5 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                            <TrashIcon className="h-3 w-3"/> Очистить
                        </button>
                    </div>
                </div>

                <div className="relative flex-1 group">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onFocus={initAudioContext}
                        maxLength={MAX_CHARS}
                        placeholder="Введите текст для озвучки..."
                        className={`w-full h-full bg-zinc-900/30 text-zinc-200 rounded-lg border border-white/5 p-4 text-sm font-light leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none transition-all placeholder:text-zinc-700 ${isRewriting ? 'opacity-50 blur-[1px]' : ''}`}
                    />
                    
                    <div className="absolute bottom-4 right-4 text-[10px] font-mono text-zinc-700">
                        {text.length} / {MAX_CHARS}
                    </div>

                    <div className="absolute bottom-4 left-4">
                         <button
                            onClick={handleRewrite}
                            disabled={!text.trim() || isRewriting}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/5 bg-indigo-900/20 hover:bg-indigo-900/40 border-indigo-500/20 text-[10px] font-medium text-indigo-300 transition-all hover:text-indigo-200 disabled:opacity-0 shadow-sm backdrop-blur-sm"
                            title="Сделать текст более естественным для выбранного голоса"
                         >
                            {isRewriting ? <span className="animate-spin">⟳</span> : <WrenchScrewdriverIcon className="h-3 w-3" />}
                            Адаптировать под голос (AI)
                         </button>
                    </div>
                </div>
            </section>

            {/* Action Bar */}
            <div className="pt-2">
                <button
                    onClick={handleGenerate}
                    disabled={!text.trim() || isLoading || isRewriting}
                    className={`w-full h-12 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                        !text.trim() || isLoading
                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                    }`}
                >
                    {isLoading ? (
                        <>
                            <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                            <span className="tracking-wide">ГЕНЕРАЦИЯ...</span>
                        </>
                    ) : (
                        <>
                            <SparklesIcon className="h-4 w-4"/>
                            <span>ОЗВУЧИТЬ</span>
                        </>
                    )}
                </button>
                {error && (
                    <div className="mt-3 text-center text-[10px] text-red-500 font-mono bg-red-500/5 py-2 rounded border border-red-500/10">
                        ОШИБКА: {error}
                    </div>
                )}
            </div>
        </div>

        {/* Right Panel: Output & Stats */}
        <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Player Module */}
            <div className={`relative bg-zinc-900/50 border border-white/5 rounded-xl p-5 transition-all duration-500 ${audioBase64 ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                 <div className="flex items-center justify-between mb-6">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${audioBase64 ? 'bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,1)]' : 'bg-zinc-700'}`}></span>
                        Плеер
                    </div>
                    {audioBase64 && (
                        <div className="flex gap-1">
                             <button onClick={() => handleDownload(audioBase64, selectedVoice, 'wav')} className="text-[9px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded border border-white/5 hover:border-zinc-600 transition-colors">.WAV</button>
                        </div>
                    )}
                 </div>

                 {/* Visualizer */}
                 <div className="mb-6 h-32 bg-black/40 rounded border border-white/5 relative overflow-hidden">
                     <AudioVisualizer analyser={analyserRef.current} isPlaying={isPlaying} />
                     {!audioBase64 && (
                         <div className="absolute inset-0 flex items-center justify-center text-zinc-700 text-[10px] font-mono uppercase tracking-wider">
                             [НЕТ АУДИО]
                         </div>
                     )}
                 </div>

                 {/* Playback Controls */}
                 <div className="flex items-center gap-4">
                     <button
                        onClick={togglePlayback}
                        className="h-10 w-10 rounded bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors"
                     >
                        {isPlaying ? <PauseIcon className="h-4 w-4"/> : <PlayIcon className="h-4 w-4 ml-0.5"/>}
                     </button>

                     <div className="flex-1">
                        <div className="flex justify-between text-[9px] text-zinc-500 font-mono mb-1">
                            <span>СКОРОСТЬ</span>
                            <span>{playbackRate.toFixed(1)}x</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={playbackRate}
                            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                        />
                     </div>
                 </div>
            </div>

            {/* History Feed */}
            <div className="flex-1 flex flex-col min-h-[200px] border-t border-white/5 pt-6 lg:border-t-0 lg:pt-0">
                <div className="flex items-center justify-between mb-4 px-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">История</label>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-[10px] text-zinc-700 font-mono">
                            // ПУСТО
                        </div>
                    ) : (
                        history.map((item) => {
                            const voiceInfo = VOICE_OPTIONS.find(v => v.id === item.voice);
                            return (
                                <div 
                                    key={item.id}
                                    onClick={() => loadFromHistory(item)}
                                    className={`group relative p-3 rounded bg-zinc-900/30 border border-white/5 hover:bg-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-center gap-3 ${item.audioBase64 === audioBase64 ? 'bg-zinc-800 border-indigo-500/30' : ''}`}
                                >
                                    <div className={`h-8 w-8 rounded bg-gradient-to-br ${voiceInfo?.gradient} flex items-center justify-center text-[9px] font-bold text-white shadow-sm`}>
                                        {getInitials(voiceInfo?.name || '')}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-zinc-300 truncate font-light">{item.text}</p>
                                        <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">
                                            {voiceInfo?.name}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDownload(item.audioBase64, item.voice, 'wav'); }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-white transition-opacity"
                                    >
                                        <ArrowDownTrayIcon className="h-3.5 w-3.5"/>
                                    </button>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;