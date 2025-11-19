import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="w-full py-8 px-4">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="MoodChain Logo" className="w-16 h-16 object-contain" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">MoodChain</h1>
            <h2 className="text-xl sm:text-2xl font-bold text-gradient-emotional">Feel Safe to Feel</h2>
          </div>
        </div>
        <div className="flex-shrink-0">
          <ConnectButton />
        </div>
      </div>
      <p className="text-center text-muted-foreground max-w-2xl mx-auto mt-4">
        Log your daily moods with complete privacy. Fully Homomorphic Encryption (FHE) analyzes
        long-term patterns without ever revealing your raw emotions.
      </p>
    </header>
  );
}




