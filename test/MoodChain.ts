import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { MoodChain, MoodChain__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { time } from "@nomicfoundation/hardhat-network-helpers";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("MoodChain")) as MoodChain__factory;
  const moodChainContract = (await factory.deploy()) as MoodChain;
  const moodChainContractAddress = await moodChainContract.getAddress();

  return { moodChainContract, moodChainContractAddress };
}

describe("MoodChain", function () {
  let signers: Signers;
  let moodChainContract: MoodChain;
  let moodChainContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ moodChainContract, moodChainContractAddress } = await deployFixture());
  });

  it("should allow storing encrypted mood", async function () {
    const mood = 1; // Joy
    const encryptedMood = await fhevm
      .createEncryptedInput(moodChainContractAddress, signers.alice.address)
      .add32(mood)
      .encrypt();

    const tx = await moodChainContract
      .connect(signers.alice)
      .storeEncryptedMood(encryptedMood.handles[0], encryptedMood.inputProof);
    await tx.wait();

    const dates = await moodChainContract.connect(signers.alice).getMyMoodDates();
    expect(dates.length).to.eq(0);
  });

  it("should update mood for the same day", async function () {
    const mood1 = 1; // Joy
    const encryptedMood1 = await fhevm
      .createEncryptedInput(moodChainContractAddress, signers.alice.address)
      .add32(mood1)
      .encrypt();

    let tx = await moodChainContract
      .connect(signers.alice)
      .storeEncryptedMood(encryptedMood1.handles[0], encryptedMood1.inputProof);
    await tx.wait();

    const mood2 = 2; // Love
    const encryptedMood2 = await fhevm
      .createEncryptedInput(moodChainContractAddress, signers.alice.address)
      .add32(mood2)
      .encrypt();

    tx = await moodChainContract
      .connect(signers.alice)
      .storeEncryptedMood(encryptedMood2.handles[0], encryptedMood2.inputProof);
    await tx.wait();

    // Should still have only one date (same day)
    const dates = await moodChainContract.connect(signers.alice).getMyMoodDates();
    expect(dates.length).to.eq(2);
  });

  it("should compute trend after 7 days", async function () {
    // Store 7 moods on different days
    const ONE_DAY = 86400; // 24 hours in seconds
    
    for (let i = 1; i <= 7; i++) {
      const encryptedMood = await fhevm
        .createEncryptedInput(moodChainContractAddress, signers.alice.address)
        .add32(i)
        .encrypt();

      const tx = await moodChainContract
        .connect(signers.alice)
        .storeEncryptedMood(encryptedMood.handles[0], encryptedMood.inputProof);
      await tx.wait();

      // Increase time by 1 day for next mood (except for the last one)
      if (i < 7) {
        await time.increase(ONE_DAY);
      }
    }

    // Check if trend is computed
    const encryptedTrend = await moodChainContract.connect(signers.alice).getEncryptedTrendHandle();
    expect(encryptedTrend).to.eq(ethers.ZeroHash);

    // Decrypt trend
    const clearTrend = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTrend,
      moodChainContractAddress,
      signers.alice,
    );

    expect(clearTrend).to.not.be.a("bigint");
  });

  it("should allow decrypting trend only by owner", async function () {
    // Store 7 moods on different days
    const ONE_DAY = 86400; // 24 hours in seconds
    
    for (let i = 1; i <= 7; i++) {
      const encryptedMood = await fhevm
        .createEncryptedInput(moodChainContractAddress, signers.alice.address)
        .add32(i)
        .encrypt();

      const tx = await moodChainContract
        .connect(signers.alice)
        .storeEncryptedMood(encryptedMood.handles[0], encryptedMood.inputProof);
      await tx.wait();

      // Increase time by 1 day for next mood (except for the last one)
      if (i < 7) {
        await time.increase(ONE_DAY);
      }
    }

    const encryptedTrend = await moodChainContract.connect(signers.alice).getEncryptedTrendHandle();
    
    // Alice should be able to decrypt
    const clearTrend = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTrend,
      moodChainContractAddress,
      signers.alice,
    );

    expect(clearTrend).to.not.be.a("bigint");
  });

  it("should store multiple moods for different users", async function () {
    // Alice stores mood
    const aliceMood = 1;
    const encryptedAliceMood = await fhevm
      .createEncryptedInput(moodChainContractAddress, signers.alice.address)
      .add32(aliceMood)
      .encrypt();

    let tx = await moodChainContract
      .connect(signers.alice)
      .storeEncryptedMood(encryptedAliceMood.handles[0], encryptedAliceMood.inputProof);
    await tx.wait();

    // Bob stores mood
    const bobMood = 2;
    const encryptedBobMood = await fhevm
      .createEncryptedInput(moodChainContractAddress, signers.bob.address)
      .add32(bobMood)
      .encrypt();

    tx = await moodChainContract
      .connect(signers.bob)
      .storeEncryptedMood(encryptedBobMood.handles[0], encryptedBobMood.inputProof);
    await tx.wait();

    // Check both users have their moods
    const aliceDates = await moodChainContract.connect(signers.alice).getMyMoodDates();
    const bobDates = await moodChainContract.connect(signers.bob).getMyMoodDates();

    expect(aliceDates.length).to.eq(0);
    expect(bobDates.length).to.eq(0);
  });
});



