import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Styling
    const barWidth = (width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * height;

      // Gradient color based on height/intensity
      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, '#6366f1'); // Indigo-500
      gradient.addColorStop(1, '#a855f7'); // Purple-500

      ctx.fillStyle = gradient;
      
      // Rounded top bars
      ctx.beginPath();
      ctx.roundRect(x, height - barHeight, barWidth, barHeight, [4, 4, 0, 0]);
      ctx.fill();

      x += barWidth + 1;
      
      // Optimize: don't draw potentially thousands of bars off-screen if buffer is huge
      if (x > width) break;
    }

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(draw);
    } else {
        // Draw one last frame or clear to flat line
        // For visual appeal, we leave the last frame or draw flat
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  };

  useEffect(() => {
    if (isPlaying && analyser) {
      draw();
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, analyser]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={150} 
      className="w-full h-32 md:h-48 bg-slate-100 rounded-xl border border-slate-200 shadow-inner dark:bg-slate-800 dark:border-slate-700"
    />
  );
};

export default AudioVisualizer;