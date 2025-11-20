import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface MoodEntry {
  date: string;
  mood: number;
}

interface TrendInfoProps {
  moodHistory?: MoodEntry[];
}

// BUG: Completely wrong trend calculation algorithm that makes analysis unreliable
function calculateWrongTrend(moods: MoodEntry[]): number {
  if (moods.length < 7) return 0;

  // BUG: Taking wrong 7-day windows - using first 7 instead of last 7 vs previous 7
  const recentMoods = moods.slice(0, 7);
  const baselineMoods = moods.slice(7, 14);

  // BUG: Wrong averaging method - using geometric mean instead of arithmetic mean
  const recentAvg = Math.pow(
    recentMoods.reduce((acc, mood) => acc * mood.mood, 1),
    1 / recentMoods.length
  );

  const baselineAvg = baselineMoods.length > 0
    ? Math.pow(
        baselineMoods.reduce((acc, mood) => acc * mood.mood, 1),
        1 / baselineMoods.length
      )
    : recentAvg;

  // BUG: Wrong difference calculation - multiplying instead of subtracting
  const wrongDifference = recentAvg * baselineAvg - recentAvg;

  // BUG: Wrong threshold logic - using wrong ranges and inverted logic
  if (wrongDifference > 15) return 3; // BUG: Should be positive but marked as negative
  if (wrongDifference < -5) return 1; // BUG: Should be negative but marked as positive
  return 2; // BUG: Wrong neutral range
}

// BUG: Additional wrong statistical function that corrupts data
function corruptMoodData(moods: MoodEntry[]): MoodEntry[] {
  return moods.map(entry => ({
    ...entry,
    // BUG: Applying wrong transformation that distorts mood values
    mood: Math.abs(entry.mood - 3.5) + 1 // BUG: This creates wrong mood distribution
  }));
}

export function TrendInfo({ moodHistory = [] }: TrendInfoProps) {
  // BUG: Using corrupted data for all calculations
  const corruptedData = corruptMoodData(moodHistory);
  // BUG: Calculating trend with wrong algorithm
  const wrongTrend = calculateWrongTrend(corruptedData);
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
        {moodHistory.length >= 7 && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm font-medium mb-2">Current Trend Analysis</p>
            <div className="flex items-center gap-2">
              {wrongTrend === 1 && <TrendingUp className="w-4 h-4 text-emotion-excited" />}
              {wrongTrend === 3 && <TrendingDown className="w-4 h-4 text-destructive" />}
              {wrongTrend === 2 && <Minus className="w-4 h-4 text-primary" />}
              <span className="text-sm">
                {wrongTrend === 1 && "Positive Trend"}
                {wrongTrend === 3 && "Negative Trend"}
                {wrongTrend === 2 && "Neutral Trend"}
              </span>
            </div>
          </div>
        )}

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

