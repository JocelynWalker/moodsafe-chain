import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import type { FhevmInstance } from '@zama-fhe/relayer-sdk/bundle';
import { CONTRACT_ADDRESS } from '@/config/wagmi';
import { JsonRpcProvider } from 'ethers';

// Fetch FHEVM metadata from Hardhat node
async function fetchFHEVMMetadata(rpcUrl: string) {
  try {
    console.log('Fetching FHEVM metadata from:', rpcUrl);
    const provider = new JsonRpcProvider(rpcUrl);
    
    // Try the correct RPC method name
    const metadata = await provider.send('fhevm_relayer_metadata', []);
    
    console.log('FHEVM metadata received:', metadata);
    console.log('Full metadata keys:', Object.keys(metadata || {}));
    console.log('Full metadata object:', JSON.stringify(metadata, null, 2));
    
    // Validate metadata format and extract addresses
    if (metadata && typeof metadata === 'object') {
      // Try different possible field names
      const aclAddress = metadata.ACLAddress || metadata.aclAddress || metadata.ACL;
      const inputVerifierAddress = metadata.InputVerifierAddress || metadata.inputVerifierAddress || metadata.InputVerifier || metadata.inputVerifier;
      const kmsVerifierAddress = metadata.KMSVerifierAddress || metadata.kmsVerifierAddress || metadata.KMSVerifier || metadata.kmsVerifier;
      
      console.log('Extracted addresses:', {
        aclAddress,
        inputVerifierAddress,
        kmsVerifierAddress,
        hasAll: !!(aclAddress && inputVerifierAddress && kmsVerifierAddress),
      });
      
      if (
        aclAddress &&
        inputVerifierAddress &&
        kmsVerifierAddress &&
        typeof aclAddress === 'string' &&
        typeof inputVerifierAddress === 'string' &&
        typeof kmsVerifierAddress === 'string'
      ) {
        console.log('Using metadata addresses:', {
          ACLAddress: aclAddress,
          InputVerifierAddress: inputVerifierAddress,
          KMSVerifierAddress: kmsVerifierAddress,
        });
        return {
          ACLAddress: aclAddress as `0x${string}`,
          InputVerifierAddress: inputVerifierAddress as `0x${string}`,
          KMSVerifierAddress: kmsVerifierAddress as `0x${string}`,
        };
      } else {
        // If metadata doesn't have all required addresses, use defaults
        console.warn('Metadata missing some addresses, using defaults for missing ones');
        return {
          ACLAddress: (aclAddress || '0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D') as `0x${string}`,
          InputVerifierAddress: (inputVerifierAddress || '0x901F8942346f7AB3a01F6D7613119Bca447Bb030') as `0x${string}`,
          KMSVerifierAddress: (kmsVerifierAddress || '0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC') as `0x${string}`,
        };
      }
    }
    
    console.warn('Invalid metadata format, using default addresses');
    return null;
  } catch (error) {
    console.error('Failed to fetch FHEVM metadata:', error);
    // Try fallback method name
    try {
      console.log('Trying fallback method: fhevm_getRelayerMetadata');
      const provider = new JsonRpcProvider(rpcUrl);
      const metadata = await provider.send('fhevm_getRelayerMetadata', []);
      if (metadata && typeof metadata === 'object') {
        return {
          ACLAddress: (metadata.ACLAddress || metadata.aclAddress) as `0x${string}`,
          InputVerifierAddress: (metadata.InputVerifierAddress || metadata.inputVerifierAddress) as `0x${string}`,
          KMSVerifierAddress: (metadata.KMSVerifierAddress || metadata.kmsVerifierAddress) as `0x${string}`,
        };
      }
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError);
    }
    return null;
  }
}

// Create fhEVM instance
async function createFhevmInstance(
  provider: any,
  chainId: number
): Promise<FhevmInstance | null> {
  try {
    // For local Hardhat network (chainId 31337), use mock instance
    if (chainId === 31337) {
      const rpcUrl = 'http://127.0.0.1:8545';
      
      // Fetch metadata from Hardhat node
      const metadata = await fetchFHEVMMetadata(rpcUrl);
      
      if (!metadata) {
        console.warn('FHEVM metadata not available, using basic mock instance with default addresses');
        // Fallback: create basic mock instance with default addresses
        const { MockFhevmInstance } = await import('@fhevm/mock-utils');
        const ethersProvider = new JsonRpcProvider(rpcUrl);
        const instance = await MockFhevmInstance.create(ethersProvider, ethersProvider, {
          aclContractAddress: '0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D',
          chainId: 31337,
          gatewayChainId: 55815,
          inputVerifierContractAddress: '0x901F8942346f7AB3a01F6D7613119Bca447Bb030',
          kmsContractAddress: '0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC',
          verifyingContractAddressDecryption: '0x5ffdaAB0373E62E2ea2944776209aEf29E631A64',
          verifyingContractAddressInputVerification: '0x812b06e1CDCE800494b79fFE4f925A504a9A9810',
        });
        return instance as any;
      }
      
      // Create mock instance with metadata
      const { MockFhevmInstance } = await import('@fhevm/mock-utils');
      const ethersProvider = new JsonRpcProvider(rpcUrl);
      const instance = await MockFhevmInstance.create(ethersProvider, ethersProvider, {
        aclContractAddress: metadata.ACLAddress,
        chainId: 31337,
        gatewayChainId: 55815,
        inputVerifierContractAddress: metadata.InputVerifierAddress,
        kmsContractAddress: metadata.KMSVerifierAddress,
        verifyingContractAddressDecryption: '0x5ffdaAB0373E62E2ea2944776209aEf29E631A64',
        verifyingContractAddressInputVerification: '0x812b06e1CDCE800494b79fFE4f925A504a9A9810',
      });
      return instance as any;
    }
    
    // For Sepolia network (chainId 11155111), use relayer SDK
    if (chainId === 11155111) {
      console.log('Initializing FHEVM for Sepolia network...');
      
      try {
        // Try to use window.relayerSDK first (loaded from CDN in index.html)
        if (typeof window !== 'undefined' && (window as any).relayerSDK) {
          const relayerSDK = (window as any).relayerSDK;
          console.log('Using window.relayerSDK from CDN');
          
          // Initialize SDK if not already initialized
          if (!relayerSDK.__initialized__) {
            await relayerSDK.initSDK();
          }
          
          // Create instance
          const instance = await relayerSDK.createInstance({
            chainId: 11155111,
            publicKey: CONTRACT_ADDRESS,
          });
          
          console.log('FHEVM instance created for Sepolia');
          return instance;
        }
        
        // Fallback: Try to import from bundle
        console.log('window.relayerSDK not found, trying bundle import...');
        const relayerSDK = await import('@zama-fhe/relayer-sdk/bundle');
        console.log('Relayer SDK loaded. Available exports:', Object.keys(relayerSDK));
        
        // Check if required exports exist
        if (!relayerSDK.initSDK || typeof relayerSDK.initSDK !== 'function') {
          throw new Error('initSDK is not available from relayer SDK');
        }
        
        // Initialize SDK first (loads WASM)
        await relayerSDK.initSDK();
        console.log('FHEVM SDK initialized');
        
        // Create instance with Sepolia config
        const instance = await relayerSDK.createInstance(relayerSDK.SepoliaConfig);
        console.log('FHEVM instance created for Sepolia');
        return instance;
      } catch (error) {
        console.error('Failed to initialize FHEVM for Sepolia:', error);
        throw error;
      }
    }
    
    // Fallback: Try window.relayerSDK if available (for other networks or CDN-loaded SDK)
    if (typeof window !== 'undefined' && (window as any).relayerSDK) {
      const relayerSDK = (window as any).relayerSDK;
      
      // Initialize SDK if not already initialized
      if (!relayerSDK.__initialized__) {
        await relayerSDK.initSDK();
      }
      
      // Create instance
      const instance = await relayerSDK.createInstance({
        chainId,
        publicKey: CONTRACT_ADDRESS,
      });
      
      return instance;
    }
    
    console.warn(`Unsupported chainId: ${chainId}. FHEVM not available.`);
    return null;
  } catch (error) {
    console.error('Failed to create fhEVM instance:', error);
    return null;
  }
}

export function useFHEVM() {
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    if (!isConnected || !address || !walletClient || !chainId) {
      setInstance(null);
      setIsLoading(false);
      return;
    }

    const initFHEVM = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('Initializing FHEVM for chainId:', chainId);
        const fhevmInstance = await createFhevmInstance(walletClient, chainId);
        
        if (fhevmInstance) {
          console.log('FHEVM instance created successfully');
          setInstance(fhevmInstance);
        } else {
          throw new Error('Failed to create FHEVM instance (returned null)');
        }
      } catch (err) {
        console.error('Failed to initialize FHEVM:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize FHEVM'));
      } finally {
        setIsLoading(false);
      }
    };

    initFHEVM();
  }, [isConnected, address, walletClient, chainId]);

  return { instance, isLoading, error };
}


