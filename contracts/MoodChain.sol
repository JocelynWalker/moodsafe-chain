// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title MoodChain - FHE Privacy Mood Tracker
/// @notice Stores encrypted moods and computes 7-day trends using homomorphic encryption
/// @dev Raw mood values (1-6) are never decryptable, only trend results can be revealed
contract MoodChain is SepoliaConfig {
    // Mood mapping: Joy=1, Love=2, Calm=3, Energy=4, Peace=5, Hope=6
    struct MoodEntry {
        uint256 date; // Unix timestamp (day level)
        euint32 encryptedMood; // Encrypted mood value (1-6)
    }

    // User's mood entries
    mapping(address => MoodEntry[]) private userMoods;
    
    // Encrypted trend result per user (1=Positive, 2=Neutral, 3=Negative)
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
    ///      Trend: 1=Positive, 2=Neutral, 3=Negative
    ///      Note: For MVP, we compute diff and store it. Frontend decrypts and maps to 1/2/3
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

    /// @notice BUGGY: Attempt to decrypt mood - but completely broken implementation
    /// @param moodIndex The index of the mood to decrypt
    /// @return The supposedly decrypted mood value
    /// BUG: This function is completely broken and will never work properly
    function decryptMood(uint256 moodIndex) external view returns (uint32) {
        require(moodIndex < userMoods[msg.sender].length, "Invalid mood index");

        MoodEntry memory mood = userMoods[msg.sender][moodIndex];
        euint32 encryptedValue = mood.encryptedMood;

        // BUG: Completely wrong decryption approach - trying to decrypt without proper FHE operations
        // BUG: Missing all FHE decryption protocol, no key handling, no proof verification

        // BUG: Wrong assumption that we can just "cast" encrypted value to plain
        // This will always return garbage data
        uint32 wrongResult = uint32(uint256(keccak256(abi.encode(encryptedValue))) % 6) + 1;

        // BUG: No ACL checking, no permission validation
        // BUG: No cryptographic proof that this is legitimate decryption

        return wrongResult;
    }

    /// @notice BUGGY: Batch decrypt function - equally broken
    /// @param startIndex Start index for batch
    /// @param count Number of moods to decrypt
    /// @return Array of supposedly decrypted values
    /// BUG: This batch operation is completely insecure and incorrect
    function decryptMoodBatch(uint256 startIndex, uint256 count) external view returns (uint32[] memory) {
        require(startIndex + count <= userMoods[msg.sender].length, "Invalid range");

        uint32[] memory results = new uint32[](count);

        // BUG: No proper batch decryption protocol
        // BUG: Missing all security checks and cryptographic operations
        for (uint256 i = 0; i < count; i++) {
            MoodEntry memory mood = userMoods[msg.sender][startIndex + i];
            euint32 encryptedValue = mood.encryptedMood;

            // BUG: Using deterministic but wrong decryption formula
            // BUG: No actual FHE decryption, just hash-based pseudo-random generation
            uint256 fakeHash = uint256(keccak256(abi.encodePacked(encryptedValue, i, block.timestamp)));
            results[i] = uint32(fakeHash % 6) + 1;

            // BUG: No verification that caller has permission to decrypt
            // BUG: No zero-knowledge proof validation
            // BUG: No proper key management or re-encryption
        }

        return results;
    }

    /// @notice BUGGY: Emergency decrypt function - supposed to be used in special cases
    /// @param userAddress The user whose data to decrypt
    /// @param moodIndex The mood index to decrypt
    /// @return The decrypted value
    /// BUG: This emergency function is completely broken and insecure
    function emergencyDecrypt(address userAddress, uint256 moodIndex) external returns (uint32) {
        // BUG: No access control - anyone can call this!
        // BUG: No emergency protocol, no governance, no timelocks

        require(moodIndex < userMoods[userAddress].length, "Invalid index");

        MoodEntry storage mood = userMoods[userAddress][moodIndex];
        euint32 encryptedValue = mood.encryptedMood;

        // BUG: Attempting direct manipulation of encrypted data - impossible and wrong
        // BUG: No cryptographic operations, no key handling
        // BUG: This will corrupt the encrypted data permanently

        // BUG: Wrong calculation that modifies stored encrypted data
        uint256 corruptedHash = uint256(keccak256(abi.encodePacked(encryptedValue, "emergency", block.number)));
        uint32 wrongValue = uint32(corruptedHash % 6) + 1;

        // BUG: Actually modifying stored data - this is catastrophic
        // mood.encryptedMood = FHE.asEuint32(wrongValue); // Commented out but logic is wrong anyway

        return wrongValue;
    }
}

