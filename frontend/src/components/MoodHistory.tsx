import { useState, useMemo } from 'react';
import { Lock, TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useMoodChain } from '@/hooks/useMoodChain';
import { cn } from '@/lib/utils';

export function MoodHistory() {
  const { moodDates, encryptedTrendHandle, decryptedTrend, decryptTrend } = useMoodChain();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get current month and year
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Create a Set of dates that have mood entries (YYYY-MM-DD format)
  const moodDatesSet = useMemo(() => {
    return new Set(moodDates.map(entry => entry.date));
  }, [moodDates]);

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentYear, currentMonth, day));
    }
    
    return days;
  }, [currentYear, currentMonth, daysInMonth, startingDayOfWeek]);

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Format date as YYYY-MM-DD
  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Check if a date has a mood entry
  const hasMoodEntry = (date: Date | null): boolean => {
    if (!date) return false;
    return moodDatesSet.has(formatDateKey(date));
  };

  // Check if date is today
  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
          <div className="space-y-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-lg font-semibold" style={{ fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif' }}>
                {monthNames[currentMonth]} {currentYear}
              </h3>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="w-full">
              {/* Day names header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                    style={{ fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif' }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, index) => {
                  const hasEntry = hasMoodEntry(date);
                  const isTodayDate = isToday(date);

                  return (
                    <div
                      key={index}
                      className={cn(
                        "aspect-square flex items-center justify-center p-1 rounded-lg border transition-all relative",
                        date === null && "opacity-0",
                        date !== null && !hasEntry && "border-border/20 bg-transparent",
                        date !== null && hasEntry && "border-border/30 bg-transparent",
                        isTodayDate && "border-primary/40"
                      )}
                    >
                      {date && (
                        <>
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isTodayDate && "text-primary font-semibold",
                              !isTodayDate && "text-foreground/80"
                            )}
                            style={{ fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif' }}
                          >
                            {date.getDate()}
                          </span>
                          {hasEntry && (
                            <>
                              {/* Small lock icon in bottom right */}
                              <Lock className="absolute bottom-0.5 right-0.5 w-2 h-2 text-primary/60" />
                              {/* Small heart icon for mood entry */}
                              <Heart className="absolute top-0.5 right-0.5 w-2 h-2 text-emotion-excited/50 fill-emotion-excited/30" />
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trend Section */}
            {encryptedTrendHandle && (
              <div className="mt-6 p-4 rounded-lg border border-border/30" style={{
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
              }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif' }}>7-Day Trend</p>
                    <p className="text-xs text-muted-foreground">Computed via FHE</p>
                  </div>
                  {decryptedTrend !== null ? (
                    <div
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 border",
                        decryptedTrend === 1
                          ? 'bg-emotion-excited/10 text-emotion-excited border-emotion-excited/20'
                          : decryptedTrend === 3
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-primary/10 text-primary border-primary/20'
                      )}
                      style={{
                        background: decryptedTrend === 1 
                          ? 'rgba(255, 150, 200, 0.05)' 
                          : decryptedTrend === 3 
                          ? 'rgba(255, 100, 100, 0.05)' 
                          : 'rgba(100, 200, 255, 0.05)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)'
                      }}
                    >
                      {getTrendIcon(decryptedTrend)}
                      {getTrendLabel(decryptedTrend)}
                    </div>
                  ) : (
                    <button
                      onClick={decryptTrend}
                      className="text-xs px-3 py-1.5 rounded-md border border-border/40 text-foreground/80 hover:text-foreground hover:border-primary/40 transition-colors"
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif'
                      }}
                    >
                      Reveal Trend
                    </button>
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



