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

    // Styling for Modern Dark SaaS
    // Sharp bars, technical look
    const barWidth = (width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * height;

      // Clean Gradient: Indigo to Transparent
      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, '#4f46e5'); // Indigo 600
      gradient.addColorStop(1, '#818cf8'); // Indigo 400

      ctx.fillStyle = gradient;
      
      // Sharp rectangles, no border radius for technical feel
      if (barHeight > 2) {
          ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
      }

      x += barWidth;
      
      if (x > width) break;
    }

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(draw);
    } else {
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
      height={120} 
      className="w-full h-full opacity-80 mix-blend-screen"
    />
  );
};

export default AudioVisualizer;