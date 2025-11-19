import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ===========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the MoodChain contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the MoodChain contract
 *
 *   npx hardhat --network localhost task:store-mood --mood 1
 *   npx hardhat --network localhost task:get-dates
 *   npx hardhat --network localhost task:decrypt-trend
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the MoodChain contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the MoodChain contract
 *
 *   npx hardhat --network sepolia task:store-mood --mood 1
 *   npx hardhat --network sepolia task:get-dates
 *   npx hardhat --network sepolia task:decrypt-trend
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:address
 *   - npx hardhat --network sepolia task:address
 */
task("task:address", "Prints the MoodChain address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const moodChain = await deployments.get("MoodChain");

  console.log("MoodChain address is " + moodChain.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost task:store-mood --mood 1
 *   - npx hardhat --network sepolia task:store-mood --mood 1
 */
task("task:store-mood", "Store an encrypted mood (1-6)")
  .addOptionalParam("address", "Optionally specify the MoodChain contract address")
  .addParam("mood", "The mood value (1=Joy, 2=Love, 3=Calm, 4=Energy, 5=Peace, 6=Hope)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const mood = parseInt(taskArguments.mood);
    if (!Number.isInteger(mood) || mood < 1 || mood > 6) {
      throw new Error(`Argument --mood must be an integer between 1 and 6`);
    }

    await fhevm.initializeCLIApi();

    const MoodChainDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("MoodChain");
    console.log(`MoodChain: ${MoodChainDeployment.address}`);

    const signers = await ethers.getSigners();

    const moodChainContract = await ethers.getContractAt("MoodChain", MoodChainDeployment.address);

    // Encrypt the mood value
    const encryptedMood = await fhevm
      .createEncryptedInput(MoodChainDeployment.address, signers[0].address)
      .add32(mood)
      .encrypt();

    const tx = await moodChainContract
      .connect(signers[0])
      .storeEncryptedMood(encryptedMood.handles[0], encryptedMood.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`MoodChain storeEncryptedMood(${mood}) succeeded!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:get-dates
 *   - npx hardhat --network sepolia task:get-dates
 */
task("task:get-dates", "Get all mood dates for the caller")
  .addOptionalParam("address", "Optionally specify the MoodChain contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const MoodChainDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("MoodChain");
    console.log(`MoodChain: ${MoodChainDeployment.address}`);

    const signers = await ethers.getSigners();

    const moodChainContract = await ethers.getContractAt("MoodChain", MoodChainDeployment.address);

    const dates = await moodChainContract.connect(signers[0]).getMyMoodDates();
    console.log(`Mood dates: ${dates.map((d: bigint) => new Date(Number(d) * 1000).toISOString()).join(", ")}`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:decrypt-trend
 *   - npx hardhat --network sepolia task:decrypt-trend
 */
task("task:decrypt-trend", "Decrypt the trend result")
  .addOptionalParam("address", "Optionally specify the MoodChain contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const MoodChainDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("MoodChain");
    console.log(`MoodChain: ${MoodChainDeployment.address}`);

    const signers = await ethers.getSigners();

    const moodChainContract = await ethers.getContractAt("MoodChain", MoodChainDeployment.address);

    const encryptedTrend = await moodChainContract.connect(signers[0]).getEncryptedTrendHandle();
    if (encryptedTrend === ethers.ZeroHash) {
      console.log(`Encrypted trend: ${encryptedTrend}`);
      console.log("Trend not computed yet");
      return;
    }

    const clearTrend = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTrend,
      MoodChainDeployment.address,
      signers[0],
    );
    
    // Map trend value: diff > 7 -> Positive (1), diff < 0 -> Negative (3), else -> Neutral (2)
    let trendLabel = "Unknown";
    if (clearTrend > 7n) {
      trendLabel = "Positive";
    } else if (clearTrend < 0n) {
      trendLabel = "Negative";
    } else {
      trendLabel = "Neutral";
    }
    
    console.log(`Encrypted trend: ${encryptedTrend}`);
    console.log(`Clear trend (diff): ${clearTrend}`);
    console.log(`Trend interpretation: ${trendLabel}`);
  });




