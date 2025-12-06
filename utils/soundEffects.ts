
// Lazy initialization of AudioContext for UI sounds
let sfxContext: AudioContext | null = null;

const getContext = (): AudioContext => {
  if (!sfxContext) {
    sfxContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Always try to resume if suspended (browsers auto-suspend audio contexts)
  if (sfxContext.state === 'suspended') {
    sfxContext.resume().catch(() => {});
  }
  return sfxContext;
};

/**
 * Plays a subtle, soft "pop" or bubble sound.
 * Much more pleasant than a harsh click.
 */
export const playClickSound = () => {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Sine wave is softer
    osc.type = 'sine';
    // Frequency sweep for a "droplet" sound
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

    // Smooth envelope
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    // Ignore audio errors
  }
};

/**
 * Plays a magical, airy arpeggio.
 * Used when generation completes successfully.
 */
export const playSuccessSound = () => {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.value = 0.05; // Keep it subtle

    // E Major 7 chord (E, G#, B, D#) - sounds magical/dreamy
    const notes = [659.25, 830.61, 987.77, 1244.51]; 

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      
      osc.connect(noteGain);
      noteGain.connect(masterGain);
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      // Stagger start times for arpeggio effect
      const startTime = now + (i * 0.05);
      const duration = 0.8;

      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(1, startTime + 0.1);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);
    });
  } catch (e) {
    console.debug(e);
  }
};

/**
 * Plays a gentle "slide up" sound.
 * Used for download actions.
 */
export const playDownloadSound = () => {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Soft rise
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
};

/**
 * Plays a soft, low "thud".
 * Less aggressive than the previous sound.
 */
export const playDeleteSound = () => {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine'; // Changed from square to sine for softness
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
};
