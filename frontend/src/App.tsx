import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { Toaster } from 'sonner';
import { config } from './config/wagmi';
import { Header } from './components/Header';
import { EmotionWheel } from './components/EmotionWheel';
import { MoodHistory } from './components/MoodHistory';
import { TrendInfo } from './components/TrendInfo';
import { useAccount } from 'wagmi';
import { useMoodChain } from './hooks/useMoodChain';

const queryClient = new QueryClient();

function AppContent() {
  const { isConnected } = useAccount();
  const { storeMood, isStoring } = useMoodChain();

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="relative z-10">
        <Header />
        
        <main className="container mx-auto px-4 py-8 space-y-12">
          <section className="flex flex-col items-center gap-8">
            <EmotionWheel 
              onMoodLog={storeMood}
              isWalletConnected={isConnected}
              isStoring={isStoring}
            />
          </section>
          
          <section>
            <TrendInfo />
          </section>
          
          <section className="max-w-2xl mx-auto">
            <MoodHistory />
          </section>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AppContent />
          <Toaster />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;



