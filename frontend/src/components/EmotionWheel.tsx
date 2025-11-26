import { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Emotion {
  id: string;
  name: string;
  color: string;
  angle: number;
}

const emotions: Emotion[] = [
  { id: 'sad', name: 'Sad', color: 'emotion-sad', angle: 0 },
  { id: 'anxious', name: 'Anxious', color: 'emotion-anxious', angle: 60 },
  { id: 'tired', name: 'Tired', color: 'emotion-tired', angle: 120 },
  { id: 'calm', name: 'Calm', color: 'emotion-calm', angle: 180 },
  { id: 'happy', name: 'Happy', color: 'emotion-happy', angle: 240 },
  { id: 'excited', name: 'Excited', color: 'emotion-excited', angle: 300 },
];

interface EmotionWheelProps {
  onMoodLog: (emotionId: string) => void;
  isWalletConnected: boolean;
  isStoring: boolean;
}


export function EmotionWheel({ onMoodLog, isWalletConnected, isStoring }: EmotionWheelProps) {
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);

  const handleEmotionClick = (emotionId: string) => {
    if (!isWalletConnected) {
      toast.error('Wallet Required', {
        description: 'Please connect your Rainbow Wallet to select emotions',
      });
      return;
    }

    setSelectedEmotion(emotionId);
  };

  const handleMoodSubmit = () => {
    if (!selectedEmotion) return;

    onMoodLog(selectedEmotion);
    setSelectedEmotion(null);
  };

  return (
    <div className="relative flex flex-col items-center justify-center gap-8 py-12">
      <div className="relative w-80 h-80 rounded-full glass-card glow-primary p-2">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full glass-card flex items-center justify-center">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Today</p>
              {selectedEmotion ? (
                <p className="text-lg font-semibold text-gradient-emotional capitalize">
                  {emotions.find((e) => e.id === selectedEmotion)?.name}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Select</p>
              )}
            </div>
          </div>
        </div>

        <div className="relative w-full h-full">
          {emotions.map((emotion) => {
            const isSelected = selectedEmotion === emotion.id;
            const rotation = emotion.angle;

            return (
              <button
                key={emotion.id}
                onClick={() => handleEmotionClick(emotion.id)}
                disabled={isStoring}
                className={cn(
                  'absolute top-1/2 left-1/2 w-32 h-32 -ml-16 -mt-16 origin-center transition-all duration-300',
                  isSelected && 'scale-110',
                  isStoring && 'opacity-50 cursor-not-allowed'
                )}
                style={{
                  transform: `rotate(${rotation}deg) translateY(-110px) rotate(-${rotation}deg)`,
                }}
              >
                <div
                  className={cn(
                    'w-16 h-16 mx-auto rounded-full flex flex-col items-center justify-center gap-1',
                    'transition-all duration-300 border-2 relative overflow-hidden',
                    isSelected && 'ring-2 ring-offset-2 ring-offset-background scale-110',
                    'border-white/20 hover:border-white/40',
                    'backdrop-blur-sm'
                  )}
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--${emotion.color})), hsl(var(--${emotion.color}) / 0.8))`,
                    boxShadow: isSelected 
                      ? `0 0 30px hsl(var(--${emotion.color}) / 0.7), 0 0 15px hsl(var(--${emotion.color}) / 0.5), inset 0 2px 10px rgba(255,255,255,0.2)` 
                      : `0 4px 15px hsl(var(--${emotion.color}) / 0.4), inset 0 1px 5px rgba(255,255,255,0.1)`,
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-full" />
                  <Unlock className="w-5 h-5 text-white drop-shadow-md relative z-10" />
                  <span className="text-xs font-semibold text-white drop-shadow-md relative z-10">{emotion.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedEmotion && (
        <Button
          variant="default"
          size="lg"
          onClick={handleMoodSubmit}
          disabled={isStoring}
          className="animate-pulse"
        >
          {isStoring ? 'Storing...' : 'Log Encrypted Mood'}
        </Button>
      )}

      {!isWalletConnected && (
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Connect your Rainbow Wallet to start tracking your encrypted moods
        </p>
      )}
    </div>
  );
}



