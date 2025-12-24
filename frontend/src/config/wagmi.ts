import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

// Define Hardhat local network with correct chainId
const hardhat = defineChain({
  id: 31337,
  name: 'Hardhat',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
      webSocket: ['ws://127.0.0.1:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Hardhat Explorer',
      url: 'http://localhost:8545',
    },
  },
});

export const config = getDefaultConfig({
  appName: 'MoodChain',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '88306a972a77389d91871e08d26516af',
  chains: [hardhat, sepolia],
  ssr: false,
});

// Contract address - defaults to local Hardhat address
// For Sepolia testnet, set VITE_CONTRACT_ADDRESS in .env file
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';


