import { Lock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useMoodChain } from '@/hooks/useMoodChain';

export function MoodHistory() {
  const { moodDates, encryptedTrendHandle, decryptedTrend, decryptTrend } = useMoodChain();

  const getTrendLabel = (trend: number | null) => {
    if (trend === null) return 'Unknown';
    if (trend === 1) return 'Positive';
    if (trend === 3) return 'Negative';
    return 'Neutral';
  };

  const getTrendIcon = (trend: number | null) => {
    if (trend === 1) return <TrendingUp className="w-4 h-4" />;
    if (trend === 3) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  return (
    <Card className="glass-card border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          Encrypted Mood History
        </CardTitle>
        <CardDescription>
          Your emotions are encrypted. Only patterns are computed via FHE.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {moodDates.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No mood entries yet. Start by logging your first mood!
          </p>
        ) : (
          <div className="space-y-3">
            {moodDates
              .slice()
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((entry, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50"
              >
                <div>
                  <p className="text-sm font-medium">{entry.date}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Encrypted
                  </p>
                </div>
              </div>
            ))}

            {encryptedTrendHandle && (
              <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/30">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium">7-Day Trend</p>
                    <p className="text-xs text-muted-foreground">Computed via FHE</p>
                  </div>
                  {decryptedTrend !== null ? (
                    <div
                      className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                        decryptedTrend === 1
                          ? 'bg-emotion-excited/20 text-emotion-excited'
                          : decryptedTrend === 3
                          ? 'bg-destructive/20 text-destructive'
                          : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {getTrendIcon(decryptedTrend)}
                      {getTrendLabel(decryptedTrend)}
                    </div>
                  ) : (
                    <Button size="sm" onClick={decryptTrend} variant="outline">
                      Reveal Trend
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}



