import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface MoodEntry {
  date: string;
  mood: number;
}

interface TrendInfoProps {
  moodHistory?: MoodEntry[];
}

export function TrendInfo({ moodHistory = [] }: TrendInfoProps) {
  return (
    <Card className="glass-card border-primary/30 max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          7-Day Trend Calculation
        </CardTitle>
        <CardDescription>
          How your emotional trend is computed using Fully Homomorphic Encryption
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The system compares the sum of your last 7 days of moods with the previous 7 days (or available baseline).
            The difference is computed entirely on encrypted data using FHE.
          </p>
          
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <TrendingUp className="w-5 h-5 text-emotion-excited" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Positive Trend</p>
                <p className="text-xs text-muted-foreground">
                  Difference &gt; 7: Your recent 7-day average is significantly higher than the baseline.
                  This indicates an upward emotional trend.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Minus className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Neutral Trend</p>
                <p className="text-xs text-muted-foreground">
                  Difference between 0 and 7: Your emotional state is relatively stable with minor fluctuations.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Negative Trend</p>
                <p className="text-xs text-muted-foreground">
                  Difference &lt; 0: Your recent 7-day average is lower than the baseline.
                  This indicates a downward emotional trend.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground italic">
              <strong>Privacy Note:</strong> Your raw mood values (1-6) are never decryptable, even by you.
              Only the computed trend difference can be revealed with your explicit signature.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

