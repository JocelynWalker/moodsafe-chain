# MoodChain - FHE Privacy Mood Tracker

A privacy-focused mood tracking application using Fully Homomorphic Encryption (FHE) to protect user emotions while enabling encrypted pattern analysis. Built with Zama's fhEVM technology.

## 🎯 Project Overview

MoodChain leverages cutting-edge Fully Homomorphic Encryption technology to create a truly private mood tracking experience. Unlike traditional applications where your emotional data is stored in plaintext, MoodChain ensures that your raw mood values remain encrypted at all times, even during computation. This means you can track your emotional patterns and trends without compromising your privacy.

## 🎥 Demo Video

Watch the demo video: (https://youtu.be/kAN8LGYWa8A)

The demo video showcases the complete workflow of MoodChain:
- Connecting a wallet using RainbowKit
- Selecting emotions on the interactive emotion wheel
- Storing encrypted moods on-chain
- Viewing mood history with encrypted entries
- Computing and decrypting 7-day emotional trends
- Understanding how FHE protects privacy throughout the process

## 🌐 Live Demo

**Vercel Deployment**: [https://moodchain-fhe-pro.vercel.app/](https://moodchain-fhe-pro.vercel.app/)

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Smart Contract](#smart-contract)
- [Encryption & Decryption Logic](#encryption--decryption-logic)
- [Contract Addresses](#contract-addresses)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Development](#development)
- [Usage](#usage)
- [Testing](#testing)
- [Repository](#repository)

## ✨ Features

- **Encrypted Mood Storage**: Store daily moods (Sad=1, Anxious=2, Tired=3, Calm=4, Happy=5, Excited=6) with FHE encryption
- **Homomorphic Trend Analysis**: Compute 7-day emotional trends without decrypting raw mood data
- **Privacy-First**: Raw mood values are never decryptable on-chain, only trend results can be revealed to the user
- **RainbowKit Integration**: Easy wallet connection with Rainbow Wallet
- **Complete MVP Loop**: Store → Compute → Decrypt trend workflow
- **Sepolia Testnet Support**: Deployed and tested on Sepolia network

## 🏗️ Architecture

The application consists of three main components:

1. **Smart Contract** (`MoodChain.sol`): Handles encrypted mood storage and homomorphic trend computation
2. **Frontend** (React + Vite): User interface for mood logging and trend visualization
3. **FHEVM Integration**: Client-side encryption/decryption using Zama's fhEVM SDK

## 📜 Smart Contract

### Contract Overview

The `MoodChain.sol` contract uses Zama's FHE library to store and compute on encrypted data:

```solidity
contract MoodChain is SepoliaConfig {
    struct MoodEntry {
        uint256 date;           // Unix timestamp (day level)
        euint32 encryptedMood;  // Encrypted mood value (1-6)
    }
    
    mapping(address => MoodEntry[]) private userMoods;
    mapping(address => euint32) private encryptedTrends;
}
```

### Key Functions

#### 1. `storeEncryptedMood(externalEuint32 encryptedMoodHandle, bytes inputProof)`

Stores an encrypted mood value for the caller:
- Converts external ciphertext to internal encrypted type using `FHE.fromExternal()`
- Stores mood entry with current date (rounded to start of day)
- Updates existing entry if mood already logged for today
- Sets ACL permissions for contract and user access
- Automatically triggers trend computation after storing

**ACL Permissions:**
- Contract can access for trend computation
- User can decrypt their own moods

#### 2. `getMyMoodDates() → uint256[]`

Returns array of all dates (Unix timestamps) where the caller has logged moods.

#### 3. `getEncryptedTrendHandle() → euint32`

Returns the encrypted trend handle for the caller. The trend is computed as:
- **Positive (diff > 7)**: Average increase of >1 per day over last 7 days
- **Neutral (0 ≤ diff ≤ 7)**: Small change
- **Negative (diff < 0)**: Decrease

#### 4. `_updateTrend(address user)` (internal)

Homomorphically computes 7-day trend:
- Sums last 7 mood values
- Compares with previous 7 mood values (if available)
- Calculates difference: `diff = sumRecent - sumPrevious`
- Stores encrypted difference that only user can decrypt

**Trend Computation Logic:**
```solidity
// Last 7 days
euint32 sumRecent = FHE.asEuint32(0);
for (uint256 i = moods.length; i > moods.length - 7; i--) {
    sumRecent = FHE.add(sumRecent, moods[i - 1].encryptedMood);
}

// Previous 7 days (baseline)
euint32 sumPrevious = FHE.asEuint32(0);
if (moods.length >= 14) {
    for (uint256 i = moods.length - 7; i > moods.length - 14; i--) {
        sumPrevious = FHE.add(sumPrevious, moods[i - 1].encryptedMood);
    }
}

// Compute difference
euint32 diff = FHE.sub(sumRecent, sumPrevious);
```

### Full Contract Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title MoodChain - FHE Privacy Mood Tracker
/// @notice Stores encrypted moods and computes 7-day trends using homomorphic encryption
/// @dev Raw mood values (1-6) are never decryptable, only trend results can be revealed
contract MoodChain is SepoliaConfig {
    // Mood mapping: Sad=1, Anxious=2, Tired=3, Calm=4, Happy=5, Excited=6
    struct MoodEntry {
        uint256 date; // Unix timestamp (day level)
        euint32 encryptedMood; // Encrypted mood value (1-6)
    }

    // User's mood entries
    mapping(address => MoodEntry[]) private userMoods;
    
    // Encrypted trend result per user (difference value)
    mapping(address => euint32) private encryptedTrends;
    
    // Track if trend has been computed for user
    mapping(address => bool) private hasTrend;

    event MoodStored(address indexed user, uint256 date);
    event TrendUpdated(address indexed user);

    /// @notice Store encrypted mood for the caller
    /// @param encryptedMoodHandle The encrypted mood handle from fhEVM
    /// @param inputProof The FHE input proof
    function storeEncryptedMood(
        externalEuint32 encryptedMoodHandle,
        bytes calldata inputProof
    ) external {
        // Convert external ciphertext to internal encrypted type
        euint32 encryptedMood = FHE.fromExternal(encryptedMoodHandle, inputProof);

        // Get current date (day level, unix timestamp)
        uint256 today = block.timestamp / 86400 * 86400; // Round to start of day

        // Check if mood already exists for today
        MoodEntry[] storage moods = userMoods[msg.sender];
        bool found = false;
        for (uint256 i = 0; i < moods.length; i++) {
            if (moods[i].date == today) {
                moods[i].encryptedMood = encryptedMood;
                found = true;
                break;
            }
        }

        if (!found) {
            moods.push(MoodEntry({
                date: today,
                encryptedMood: encryptedMood
            }));
        }

        // Set ACL permissions: allow contract and user to access encrypted mood
        FHE.allowThis(encryptedMood);
        FHE.allow(encryptedMood, msg.sender);

        emit MoodStored(msg.sender, today);

        // Auto-compute trend after storing mood
        _updateTrend(msg.sender);
    }

    /// @notice Get all mood dates for the caller
    /// @return dates Array of dates (Unix timestamps)
    function getMyMoodDates() external view returns (uint256[] memory dates) {
        MoodEntry[] memory moods = userMoods[msg.sender];
        dates = new uint256[](moods.length);
        for (uint256 i = 0; i < moods.length; i++) {
            dates[i] = moods[i].date;
        }
        return dates;
    }

    /// @notice Get the encrypted trend handle for the caller
    /// @return The encrypted trend handle (euint32)
    function getEncryptedTrendHandle() external view returns (euint32) {
        require(hasTrend[msg.sender], "Trend not computed yet");
        return encryptedTrends[msg.sender];
    }

    /// @notice Internal function to compute 7-day trend using homomorphic operations
    /// @param user The user address
    /// @dev Computes trend by comparing sum of last 7 days with previous 7 days
    function _updateTrend(address user) internal {
        MoodEntry[] memory moods = userMoods[user];
        
        // Need at least 7 days of data to compute trend
        if (moods.length < 7) {
            return;
        }

        // Get last 7 moods (most recent)
        euint32 sumRecent = FHE.asEuint32(0);
        for (uint256 i = moods.length; i > moods.length - 7; i--) {
            sumRecent = FHE.add(sumRecent, moods[i - 1].encryptedMood);
        }

        // Get previous 7 moods (before the last 7) if available
        euint32 sumPrevious = FHE.asEuint32(0);
        if (moods.length >= 14) {
            // Use previous 7 days as baseline
            for (uint256 i = moods.length - 7; i > moods.length - 14; i--) {
                sumPrevious = FHE.add(sumPrevious, moods[i - 1].encryptedMood);
            }
        } else if (moods.length > 7) {
            // If less than 14 days, use first available days as baseline
            uint256 availableDays = moods.length - 7;
            for (uint256 i = 0; i < availableDays; i++) {
                sumPrevious = FHE.add(sumPrevious, moods[i].encryptedMood);
            }
        }
        // If exactly 7 days, sumPrevious remains 0 (compare with baseline of 0)

        // Compute difference: diff = sumRecent - sumPrevious
        // Frontend will decrypt diff and interpret:
        // - If diff > 7: Positive trend (1) - average increase of >1 per day
        // - If diff < 0: Negative trend (3) - decrease
        // - Otherwise: Neutral trend (2) - small change
        euint32 diff = FHE.sub(sumRecent, sumPrevious);
        
        encryptedTrends[user] = diff;
        hasTrend[user] = true;
        
        // Set ACL: only user can decrypt their trend
        FHE.allowThis(diff);
        FHE.allow(diff, user);

        emit TrendUpdated(user);
    }
}
```

## 🔐 Encryption & Decryption Logic

### Encryption Flow (Storing Mood)

1. **Create Encrypted Input** (`useMoodChain.tsx`):
   ```typescript
   const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
   input.add32(moodValue);  // moodValue: 1-6
   const encrypted = await input.encrypt();
   ```

2. **Components**:
   - `encrypted.handles[0]`: The encrypted mood handle (bytes32)
   - `encrypted.inputProof`: FHE input proof for verification

3. **Transaction**:
   ```typescript
   await moodChainContract.storeEncryptedMood(
     encrypted.handles[0],
     encrypted.inputProof
   );
   ```

4. **On-Chain Processing**:
   - Contract receives `externalEuint32` handle
   - Converts to internal `euint32` using `FHE.fromExternal()`
   - Stores with ACL permissions
   - Automatically computes trend using homomorphic operations

### Decryption Flow (Revealing Trend)

1. **Get Encrypted Trend Handle**:
   ```typescript
   const trendHandle = await contract.getEncryptedTrendHandle();
   ```

2. **Create Decryption Keypair**:
   ```typescript
   const keypair = instance.generateKeypair();
   ```

3. **Create EIP712 Signature**:
   ```typescript
   const eip712 = instance.createEIP712(
     keypair.publicKey,
     contractAddresses,
     startTimestamp,
     durationDays
   );
   const signature = await walletClient.signTypedData({
     account: address,
     domain: eip712.domain,
     types: eip712.types,
     primaryType: eip712.primaryType,
     message: eip712.message,
   });
   ```

4. **Request User Decryption**:
   ```typescript
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
   ```

5. **Interpret Decrypted Value**:
   ```typescript
   const decryptedValue = result[encryptedTrendHandle];
   // Map diff to trend:
   // - diff > 7: Positive (1)
   // - diff < 0: Negative (3)
   // - else: Neutral (2)
   ```

### FHEVM Instance Setup

The FHEVM instance is initialized differently for local and testnet:

**Local (Hardhat - ChainId 31337)**:
- Uses `MockFhevmInstance` from `@fhevm/mock-utils`
- Fetches metadata from Hardhat node via `fhevm_relayer_metadata` RPC call
- Falls back to default addresses if metadata unavailable

**Sepolia (ChainId 11155111)**:
- Uses Zama's Relayer SDK from CDN or bundle
- Initializes with `SepoliaConfig`
- Connects to Zama's FHE network for real encryption/decryption

See `frontend/src/hooks/useFHEVM.tsx` for full implementation details.

## 📍 Contract Addresses

### Local Development (Hardhat)

**Network**: Localhost (ChainId: 31337)  
**Contract Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`

To use locally:
1. Start Hardhat node: `npx hardhat node`
2. Deploy contract: `npx hardhat --network localhost deploy`
3. Update `frontend/.env`: `VITE_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3`

### Sepolia Testnet

**Network**: Sepolia (ChainId: 11155111)  
**Contract Address**: `0xc221222A36F0473944946Ee946c9e87B4d63b52C`

- **Explorer**: [View on Etherscan](https://sepolia.etherscan.io/address/0xc221222A36F0473944946Ee946c9e87B4d63b52C)
- The contract is already deployed and configured in the frontend
- Default contract address in `frontend/src/config/wagmi.ts` points to Sepolia

### Configuration

The contract address is configured in `frontend/src/config/wagmi.ts`:

```typescript
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0xc221222A36F0473944946Ee946c9e87B4d63b52C';
```

Override via environment variable:
```bash
# frontend/.env
VITE_CONTRACT_ADDRESS=0xYourContractAddress
```

## 📁 Project Structure

```
moodchain-fhe/
├── contracts/
│   └── MoodChain.sol          # Main FHE smart contract
├── deploy/
│   └── deploy.ts              # Deployment script
├── deployments/
│   ├── localhost/
│   │   └── MoodChain.json     # Local deployment info
│   └── sepolia/
│       └── MoodChain.json     # Sepolia deployment info
├── frontend/
│   ├── src/
│   │   ├── components/        # UI components
│   │   │   ├── EmotionWheel.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── MoodHistory.tsx
│   │   │   └── TrendInfo.tsx
│   │   ├── hooks/
│   │   │   ├── useFHEVM.tsx   # FHEVM instance management
│   │   │   └── useMoodChain.tsx  # Contract interaction & encryption logic
│   │   └── config/
│   │       └── wagmi.ts       # Wagmi/RainbowKit config & contract address
│   └── package.json
├── test/
│   ├── MoodChain.ts           # Local tests
│   └── MoodChainSepolia.ts    # Sepolia tests
├── tasks/
│   └── MoodChain.ts           # Hardhat tasks
├── hardhat.config.ts          # Hardhat configuration
├── moodchain-fhe.mp4          # Demo video
└── README.md                  # This file
```

## 🚀 Setup

### Prerequisites

- **Node.js** >= 20
- **npm** >= 7.0.0
- **Git**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/JocelynWalker/moodsafe-chain.git
   cd moodsafe-chain
   ```

2. **Install root dependencies**:
   ```bash
   npm install
   ```

3. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Configure environment variables** (optional):
   ```bash
   cd frontend
   cp .env.example .env  # If .env.example exists
   ```

   Create `frontend/.env` if needed:
   ```bash
   # WalletConnect Project ID (get from https://cloud.walletconnect.com)
   VITE_WALLETCONNECT_PROJECT_ID=your_project_id
   
   # Contract address (optional, defaults to Sepolia address)
   VITE_CONTRACT_ADDRESS=0xc221222A36F0473944946Ee946c9e87B4d63b52C
   ```

## 💻 Development

### Smart Contract Development

#### Compile Contracts

```bash
npm run compile
```

#### Run Tests

**Local Tests**:
```bash
npm test
```

**Sepolia Tests**:
```bash
npm run test:sepolia
```

#### Deploy to Local Network

1. **Terminal 1**: Start Hardhat node with FHE support
   ```bash
   npx hardhat node
   ```

2. **Terminal 2**: Deploy contract
   ```bash
   npx hardhat --network localhost deploy
   ```

   Note the deployed contract address and update `frontend/.env` if different from default.

#### Deploy to Sepolia Testnet

1. **Setup environment**:
   ```bash
   # Create .env in project root
   PRIVATE_KEY=your_sepolia_wallet_private_key
   SEPOLIA_RPC_URL=your_sepolia_rpc_url
   ```

2. **Deploy**:
   ```bash
   npx hardhat --network sepolia deploy
   ```

3. **Update frontend configuration**:
   - Update `VITE_CONTRACT_ADDRESS` in `frontend/.env` with deployed address

### Frontend Development

1. **Start development server**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Open browser**:
   - Navigate to `http://localhost:8080` (or the port shown in terminal)

3. **Connect wallet**:
   - Click "Connect Wallet" button
   - Select your wallet (MetaMask, WalletConnect, etc.)
   - Switch to Hardhat (localhost:8545) or Sepolia network

## 📖 Usage

### For Users

1. **Connect Wallet**
   - Click "Connect Wallet" in the top-right corner
   - Approve the connection in your wallet
   - Ensure you're on the correct network (Hardhat local or Sepolia)

2. **Log Your Mood**
   - Select an emotion from the emotion wheel:
     - Sad (1)
     - Anxious (2)
     - Tired (3)
     - Calm (4)
     - Happy (5)
     - Excited (6)
   - Click "Log Encrypted Mood"
   - Approve the transaction in your wallet
   - Wait for transaction confirmation

3. **View Mood History**
   - Your mood history appears below the emotion wheel
   - Shows dates where you've logged moods (dates are public, moods are encrypted)

4. **Reveal Trend**
   - After logging at least 7 moods
   - Click "Reveal Trend" button
   - Approve the decryption request in your wallet
   - View your emotional trend:
     - **Positive**: Improving mood over last 7 days
     - **Neutral**: Stable mood
     - **Negative**: Declining mood

### Privacy Guarantees

- **Raw mood values** are never decryptable on-chain
- Only **trend results** can be revealed by the user
- Even the contract cannot decrypt individual mood values
- All computations are done on encrypted data using homomorphic operations

## 🧪 Testing

### Local Tests

Run tests on local Hardhat network:

```bash
npm test
```

Tests cover:
- Mood storage
- Trend computation
- ACL permissions
- Edge cases

### Sepolia Testnet Tests

Run tests on Sepolia (requires deployed contract):

```bash
npm run test:sepolia
```

### Manual Testing

1. **Test Encryption**:
   - Log a mood and verify transaction succeeds
   - Check that mood date appears in history
   - Verify mood value is not readable from blockchain

2. **Test Trend Computation**:
   - Log 7+ moods on consecutive days
   - Verify trend is computed automatically
   - Check that trend handle is available

3. **Test Decryption**:
   - Click "Reveal Trend" after 7+ moods
   - Approve decryption request
   - Verify trend result is displayed correctly

## 🔗 Repository

**GitHub Repository**: [https://github.com/JocelynWalker/moodsafe-chain.git](https://github.com/JocelynWalker/moodsafe-chain.git)

To contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📚 Technology Stack

### Smart Contracts
- **Solidity** ^0.8.24
- **Zama fhEVM** - Fully Homomorphic Encryption on Ethereum
- **Hardhat** - Development framework

### Frontend
- **React** 18
- **TypeScript**
- **Vite** - Build tool
- **Wagmi** - React Hooks for Ethereum
- **RainbowKit** - Wallet connection UI
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components

### FHE Integration
- **@zama-fhe/relayer-sdk** - FHEVM SDK for Sepolia
- **@fhevm/mock-utils** - Mock FHEVM for local development

## 🔒 Security Considerations

- **Private Keys**: Never commit private keys or `.env` files to version control
- **ACL Permissions**: The contract sets appropriate ACL permissions for encrypted data
- **Input Validation**: Contract validates input proofs before accepting encrypted data
- **Trend Computation**: Trend computation requires at least 7 mood entries to ensure statistical significance
- **User Decryption**: Only the user who owns the data can decrypt trend results

## 📄 License

BSD-3-Clause-Clear

## 🙏 Acknowledgments

- [Zama](https://www.zama.ai/) for fhEVM technology
- [RainbowKit](https://www.rainbowkit.com/) for wallet connection UI
- [Wagmi](https://wagmi.sh/) for Ethereum React Hooks

## 📞 Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/JocelynWalker/moodsafe-chain/issues)
- Check the demo video for usage examples
- Visit the [live demo](https://moodchain-fhe.vercel.app/)

---

**Built with ❤️ using Zama's fhEVM**
