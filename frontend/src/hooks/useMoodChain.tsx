import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWalletClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const [moodDates, setMoodDates] = useState<MoodEntry[]>([]);
  const [encryptedTrendHandle, setEncryptedTrendHandle] = useState<string | null>(null);
  const [decryptedTrend, setDecryptedTrend] = useState<number | null>(null);
  const [isStoring, setIsStoring] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash: txHash as `0x${string}` | undefined 
  });

  // Read mood dates - with reduced polling frequency to avoid spamming Hardhat node
  const { data: dates, refetch: refetchDates, isLoading: isLoadingDates, error: datesError } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: MOOD_ABI,
    functionName: 'getMyMoodDates',
    account: address, // Explicitly specify account
    query: {
      enabled: isConnected && !!address && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10000, // Poll every 10 seconds instead of default 4 seconds
      staleTime: 0, // Always consider data stale to force refetch
      gcTime: 0, // Don't cache
    },
  });
  
  // Debug: log dates changes
  useEffect(() => {
    console.log('useReadContract dates changed:', { 
      dates, 
      isLoadingDates, 
      isConnected, 
      address,
      datesError,
      datesType: typeof dates,
      datesIsArray: Array.isArray(dates),
    });
  }, [dates, isLoadingDates, isConnected, address, datesError]);

  // Read encrypted trend handle - with reduced polling frequency
  // Note: This will fail if trend is not computed yet (less than 7 days), which is expected
  const { data: trendHandle, refetch: refetchTrend, error: trendError, isLoading: isLoadingTrend } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: MOOD_ABI,
    functionName: 'getEncryptedTrendHandle',
    account: address, // Explicitly specify account
    query: {
      enabled: isConnected && !!address && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10000, // Poll every 10 seconds instead of default 4 seconds
      staleTime: 0, // Always consider data stale to force refetch
      gcTime: 0, // Don't cache
      retry: false, // Don't retry on error (trend not computed is expected)
    },
  });
  
  // Debug: log trend handle changes
  useEffect(() => {
    console.log('Trend handle changed:', { 
      trendHandle, 
      trendError,
      isLoadingTrend,
      hasTrend: !!trendHandle && trendHandle !== '0x0000000000000000000000000000000000000000000000000000000000000000',
      errorMessage: trendError?.message,
    });
  }, [trendHandle, trendError, isLoadingTrend]);

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

  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    console.log('Dates effect triggered:', { dates, isConnected, datesType: typeof dates, datesIsArray: Array.isArray(dates) });
    
    if (dates !== undefined && dates !== null) {
      // dates can be an empty array, which is valid
      console.log('Processing dates:', dates, 'Length:', dates.length);
      const entries: MoodEntry[] = dates.map((date: bigint) => {
        const formatted = formatDateLocal(Number(date));
        console.log('Date conversion:', { original: date, timestamp: Number(date), formatted });
        return {
          date: formatted,
          encrypted: true,
        };
      });
      console.log('Mood dates updated:', entries);
      setMoodDates(entries);
    } else if (!isConnected) {
      // Clear dates when disconnected
      console.log('Clearing dates - not connected');
      setMoodDates([]);
    } else {
      console.log('Dates is undefined or null, but connected:', { dates, isConnected });
    }
  }, [dates, isConnected]);

  useEffect(() => {
    // Only set trend handle if we have valid data and no error
    // Error is expected when trend is not computed yet (less than 7 days)
    if (trendHandle && trendHandle !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log('Setting encrypted trend handle:', trendHandle);
      setEncryptedTrendHandle(trendHandle);
    } else if (trendError) {
      // Trend not computed yet - this is normal if we have less than 7 days
      console.log('Trend not computed yet (expected if < 7 days):', trendError.message);
      setEncryptedTrendHandle(null);
    } else {
      setEncryptedTrendHandle(null);
    }
  }, [trendHandle, trendError]);

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
        const tx = await moodChainContract.storeEncryptedMood(
          encrypted.handles[0],
          encrypted.inputProof
        );
        
        console.log('Transaction sent, hash:', tx.hash);
        setTxHash(tx.hash);
        toast.info('Transaction submitted. Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        console.log('Receipt block number:', receipt.blockNumber);
        console.log('Receipt logs count:', receipt.logs?.length || 0);
        
        // Check for MoodStored event in logs
        if (receipt.logs && receipt.logs.length > 0) {
          console.log('Transaction logs:', receipt.logs);
          // The MoodStored event should be in the logs
          for (const log of receipt.logs) {
            try {
              const parsedLog = moodChainContract.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              });
              if (parsedLog && parsedLog.name === 'MoodStored') {
                console.log('MoodStored event found:', parsedLog.args);
              }
            } catch (e) {
              // Not a MoodStored event, ignore
            }
          }
        }
        
        // Immediately refresh data after transaction confirmation
        toast.success('Mood stored successfully!');
        
        // Wait for block to be mined and state to update (longer wait for Hardhat)
        console.log('Waiting for blockchain state to update...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try direct contract call to verify data
        console.log('Making direct contract call to verify...');
        try {
          const signer = await walletClientToSigner(walletClient);
          const moodChainContract = new Contract(CONTRACT_ADDRESS, MOOD_ABI, signer);
          const directDates = await moodChainContract.getMyMoodDates();
          console.log('Direct contract call result:', directDates);
          console.log('Direct dates length:', directDates.length);
          if (directDates.length > 0) {
            console.log('Direct dates values:', directDates.map((d: bigint) => ({
              raw: d.toString(),
              timestamp: Number(d),
              date: new Date(Number(d) * 1000).toISOString(),
            })));
          }
        } catch (error) {
          console.error('Direct contract call error:', error);
        }
        
        // Invalidate and refetch to ensure fresh data
        console.log('Invalidating query cache...');
        await queryClient.invalidateQueries({
          queryKey: [
            'readContract',
            {
              address: CONTRACT_ADDRESS,
              functionName: 'getMyMoodDates',
            },
          ],
        });
        
        console.log('Refetching dates...');
        const datesResult = await refetchDates();
        console.log('Dates refetch result:', datesResult);
        console.log('Dates data:', datesResult.data);
        console.log('Dates data type:', typeof datesResult.data);
        console.log('Dates is array:', Array.isArray(datesResult.data));
        
        // Force another refetch after a short delay to ensure data is fresh
        setTimeout(async () => {
          console.log('Second refetch after delay...');
          try {
            const signer = await walletClientToSigner(walletClient);
            const moodChainContract = new Contract(CONTRACT_ADDRESS, MOOD_ABI, signer);
            const directDates2 = await moodChainContract.getMyMoodDates();
            console.log('Second direct call result:', directDates2);
          } catch (error) {
            console.error('Second direct call error:', error);
          }
          
          await queryClient.invalidateQueries({
            queryKey: [
              'readContract',
              {
                address: CONTRACT_ADDRESS,
                functionName: 'getMyMoodDates',
              },
            ],
          });
          const secondRefetch = await refetchDates();
          console.log('Second refetch result:', secondRefetch.data);
        }, 2000);
        
        // Check if we have 7 or more days, then try to get trend
        const datesAfterStore = await moodChainContract.getMyMoodDates();
        console.log('Dates after storing:', datesAfterStore.length);
        
        if (datesAfterStore.length >= 7) {
          console.log('Have 7+ days, checking for trend...');
          // Wait a bit for trend computation to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Try to get trend directly
          try {
            const directTrend = await moodChainContract.getEncryptedTrendHandle();
            console.log('Direct trend call result:', directTrend);
            if (directTrend && directTrend !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              console.log('Trend available!');
            }
          } catch (error: any) {
            console.log('Trend not computed yet (expected if just reached 7 days):', error?.message);
          }
        }
        
        console.log('Refetching trend...');
        await queryClient.invalidateQueries({
          queryKey: [
            'readContract',
            {
              address: CONTRACT_ADDRESS,
              functionName: 'getEncryptedTrendHandle',
            },
          ],
        });
        const trendResult = await refetchTrend();
        console.log('Trend refetch result:', trendResult);
        
        // If we have 7+ days but trend failed, try again after a delay
        if (datesAfterStore.length >= 7 && trendResult.error) {
          console.log('Retrying trend fetch after delay...');
          setTimeout(async () => {
            await queryClient.invalidateQueries({
              queryKey: [
                'readContract',
                {
                  address: CONTRACT_ADDRESS,
                  functionName: 'getEncryptedTrendHandle',
                },
              ],
            });
            await refetchTrend();
          }, 3000);
        }
        
        setTxHash(null);
        
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
    [instance, address, isConnected, walletClient, refetchDates, refetchTrend]
  );

  // Backup refresh in case useWaitForTransactionReceipt detects success
  // (though we already refresh in storeMood after tx.wait())
  useEffect(() => {
    if (isSuccess && txHash) {
      console.log('Transaction confirmed successfully (via useWaitForTransactionReceipt)');
      // Only refresh if not already refreshed in storeMood
      // This is a backup mechanism
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

