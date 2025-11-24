import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWalletClient } from 'wagmi';
import { Contract } from 'ethers';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { CONTRACT_ADDRESS } from '@/config/wagmi';
import { useFHEVM } from './useFHEVM';
import { toast } from 'sonner';

// Mood mapping: Sad=1, Anxious=2, Tired=3, Calm=4, Happy=5, Excited=6
const MOOD_MAP: Record<string, number> = {
  sad: 1,
  anxious: 2,
  tired: 3,
  calm: 4,
  happy: 5,
  excited: 6,
};

const MOOD_ABI = [
  {
    inputs: [
      { internalType: 'externalEuint32', name: 'encryptedMoodHandle', type: 'bytes32' },
      { internalType: 'bytes', name: 'inputProof', type: 'bytes' },
    ],
    name: 'storeEncryptedMood',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getMyMoodDates',
    outputs: [{ internalType: 'uint256[]', name: 'dates', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEncryptedTrendHandle',
    outputs: [{ internalType: 'euint32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface MoodEntry {
  date: string;
  encrypted: boolean;
}

// Helper to convert walletClient to ethers signer
function walletClientToSigner(walletClient: any): Promise<JsonRpcSigner> {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  const provider = new BrowserProvider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

export function useMoodChain() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { instance } = useFHEVM();
  const [moodDates, setMoodDates] = useState<MoodEntry[]>([]);
  const [encryptedTrendHandle, setEncryptedTrendHandle] = useState<string | null>(null);
  const [decryptedTrend, setDecryptedTrend] = useState<number | null>(null);
  const [isStoring, setIsStoring] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash: txHash as `0x${string}` | undefined 
  });

  // Read mood dates - with reduced polling frequency to avoid spamming Hardhat node
  const { data: dates, refetch: refetchDates } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: MOOD_ABI,
    functionName: 'getMyMoodDates',
    query: {
      enabled: isConnected && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10000, // Poll every 10 seconds instead of default 4 seconds
      staleTime: 5000, // Consider data fresh for 5 seconds
    },
  });

  // Read encrypted trend handle - with reduced polling frequency
  const { data: trendHandle, refetch: refetchTrend } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: MOOD_ABI,
    functionName: 'getEncryptedTrendHandle',
    query: {
      enabled: isConnected && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10000, // Poll every 10 seconds instead of default 4 seconds
      staleTime: 5000, // Consider data fresh for 5 seconds
    },
  });

  // Clear all data and refetch when account changes
  useEffect(() => {
    setMoodDates([]);
    setEncryptedTrendHandle(null);
    setDecryptedTrend(null);
    setTxHash(null);
    // Refetch data for the new account
    if (isConnected && address) {
      refetchDates();
      refetchTrend();
    }
  }, [address, isConnected, refetchDates, refetchTrend]);

  useEffect(() => {
    if (dates) {
      const entries: MoodEntry[] = dates.map((date: bigint) => ({
        date: new Date(Number(date) * 1000).toISOString().split('T')[0],
        encrypted: true,
      }));
      setMoodDates(entries);
    } else if (!isConnected) {
      // Clear dates when disconnected
      setMoodDates([]);
    }
  }, [dates, isConnected]);

  useEffect(() => {
    if (trendHandle && trendHandle !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      setEncryptedTrendHandle(trendHandle);
    } else {
      setEncryptedTrendHandle(null);
    }
  }, [trendHandle]);

  const storeMood = useCallback(
    async (emotionId: string) => {
      console.log('storeMood called with emotionId:', emotionId);
      console.log('instance:', instance);
      console.log('address:', address);
      console.log('isConnected:', isConnected);
      console.log('CONTRACT_ADDRESS:', CONTRACT_ADDRESS);

      if (!instance) {
        console.error('FHEVM instance is not available');
        toast.error('FHEVM not initialized. Please wait and try again.');
        return;
      }

      if (!address || !isConnected) {
        console.error('Wallet not connected');
        toast.error('Please connect your wallet first');
        return;
      }

      if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
        console.error('Contract address not set');
        toast.error('Contract address not configured');
        return;
      }

      const moodValue = MOOD_MAP[emotionId];
      if (!moodValue) {
        console.error('Invalid emotion ID:', emotionId);
        toast.error('Invalid emotion');
        return;
      }

      try {
        setIsStoring(true);
        setTxHash(null);
        
        console.log('Starting encryption for mood value:', moodValue);
        
        // Check if instance has required methods
        if (typeof instance.createEncryptedInput !== 'function') {
          throw new Error('FHEVM instance does not have createEncryptedInput method');
        }
        console.log('Instance methods check passed');
        
        // Encrypt mood
        console.log('Creating encrypted input...');
        const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
        console.log('Input created:', input);
        
        if (typeof input.add32 !== 'function') {
          throw new Error('Input object does not have add32 method');
        }
        console.log('Adding mood value...');
        input.add32(moodValue);
        console.log('Mood value added');
        
        if (typeof input.encrypt !== 'function') {
          throw new Error('Input object does not have encrypt method');
        }
        console.log('Encrypting...');
        const encrypted = await input.encrypt();
        console.log('Encryption successful:', {
          handles: encrypted.handles,
          hasInputProof: !!encrypted.inputProof,
          handlesLength: encrypted.handles?.length,
        });

        // Use ethers Contract instead of viem writeContract
        // This matches the pattern used in ConfidentialAAVE
        if (!walletClient) {
          throw new Error('Wallet client not available');
        }
        
        const signer = await walletClientToSigner(walletClient);
        const moodChainContract = new Contract(CONTRACT_ADDRESS, MOOD_ABI, signer);
        
        console.log('Calling contract.storeEncryptedMood...');
        // BUG: Parameters completely reversed - inputProof goes first, encrypted handle second
        // BUG: This will cause the contract to receive wrong data types in wrong positions
        // BUG: Additionally, the contract expects (externalEuint32, bytes) but gets (bytes, bytes32)
        const tx = await moodChainContract.storeEncryptedMood(
          encrypted.inputProof,    // BUG: Should be encrypted.handles[0] - wrong type (bytes)
          encrypted.handles[0]     // BUG: Should be encrypted.inputProof - wrong type (bytes32)
        );

        // BUG: Wrong transaction parameters - should check gas limits and other tx params
        // BUG: No proper error handling for parameter type mismatches
        
        console.log('Transaction sent, hash:', tx.hash);
        setTxHash(tx.hash);
        toast.info('Transaction submitted. Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        
      } catch (error) {
        console.error('Failed to store mood:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        toast.error(`Failed to store mood: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsStoring(false);
      }
    },
    [instance, address, isConnected, walletClient]
  );

  useEffect(() => {
    if (isSuccess && txHash) {
      console.log('Transaction confirmed successfully');
      toast.success('Mood stored successfully!');
      refetchDates();
      refetchTrend();
      setTxHash(null);
    }
  }, [isSuccess, txHash, refetchDates, refetchTrend]);

  const decryptTrend = useCallback(async () => {
    if (!instance || !address || !encryptedTrendHandle || !walletClient) {
      toast.error('Cannot decrypt trend');
      return;
    }

    try {
      const keypair = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);

      // Sign EIP712 using walletClient
      const signature = await walletClient.signTypedData({
        account: address as `0x${string}`,
        domain: eip712.domain as any,
        types: eip712.types as any,
        primaryType: eip712.primaryType as any,
        message: eip712.message as any,
      });

      // Decrypt
      const result = await instance.userDecrypt(
        [{ handle: encryptedTrendHandle, contractAddress: CONTRACT_ADDRESS }],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimestamp,
        durationDays
      );

      const decryptedValue = result[encryptedTrendHandle];
      if (typeof decryptedValue === 'bigint') {
        // Map diff to trend: >7 -> Positive (1), <0 -> Negative (3), else -> Neutral (2)
        let trend = 2; // Neutral
        if (decryptedValue > 7n) {
          trend = 1; // Positive
        } else if (decryptedValue < 0n) {
          trend = 3; // Negative
        }
        setDecryptedTrend(trend);
        toast.success(`Trend revealed: ${trend === 1 ? 'Positive' : trend === 3 ? 'Negative' : 'Neutral'}`);
      }
    } catch (error) {
      console.error('Failed to decrypt trend:', error);
      toast.error('Failed to decrypt trend');
    }
  }, [instance, address, encryptedTrendHandle, walletClient]);

  return {
    moodDates,
    encryptedTrendHandle,
    decryptedTrend,
    storeMood,
    decryptTrend,
    isStoring: isStoring || isConfirming,
    refetchDates,
    refetchTrend,
  };
}

