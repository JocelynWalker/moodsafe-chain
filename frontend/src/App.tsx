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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { isConnected } = useAccount();
  const { storeMood, isStoring } = useMoodChain();

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Starfield background */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            /* Stars - larger and more visible */
            radial-gradient(circle, rgba(255, 255, 255, 1) 1px, transparent 1px),
            radial-gradient(circle, rgba(255, 255, 255, 0.8) 0.8px, transparent 0.8px),
            radial-gradient(circle, rgba(200, 220, 255, 0.9) 1px, transparent 1px),
            radial-gradient(circle, rgba(255, 255, 255, 0.7) 0.6px, transparent 0.6px),
            radial-gradient(circle, rgba(200, 200, 255, 0.8) 0.9px, transparent 0.9px),
            radial-gradient(circle, rgba(255, 255, 255, 0.6) 0.7px, transparent 0.7px),
            /* Nebula clouds - subtle */
            radial-gradient(ellipse at 20% 30%, rgba(100, 150, 255, 0.12) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 70%, rgba(200, 100, 255, 0.1) 0%, transparent 60%),
            radial-gradient(ellipse at 50% 50%, rgba(150, 200, 255, 0.08) 0%, transparent 70%),
            radial-gradient(ellipse at 10% 80%, rgba(100, 200, 255, 0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 20%, rgba(255, 150, 200, 0.06) 0%, transparent 50%)
          `,
          backgroundSize: `
            200px 200px,
            180px 180px,
            220px 220px,
            160px 160px,
            240px 240px,
            190px 190px,
            120% 120%,
            110% 110%,
            100% 100%,
            130% 130%,
            125% 125%
          `,
          backgroundPosition: `
            5% 10%,
            15% 25%,
            25% 15%,
            35% 30%,
            45% 20%,
            55% 35%,
            20% 30%,
            80% 70%,
            50% 50%,
            10% 80%,
            90% 20%
          `
        }}
      />
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



