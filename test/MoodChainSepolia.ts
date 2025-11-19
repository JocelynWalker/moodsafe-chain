import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { MoodChain, MoodChain__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("MoodChain")) as MoodChain__factory;
  const moodChainContract = (await factory.deploy()) as MoodChain;
  const moodChainContractAddress = await moodChainContract.getAddress();

  return { moodChainContract, moodChainContractAddress };
}

describe("MoodChain Sepolia", function () {
  let signers: Signers;
  let moodChainContract: MoodChain;
  let moodChainContractAddress: string;

  before(async function () {
    // Check whether the tests are running against Sepolia
    if (fhevm.isMock) {
      console.warn(`This test suite is for Sepolia Testnet`);
      this.skip();
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    ({ moodChainContract, moodChainContractAddress } = await deployFixture());
  });

  it("should allow storing encrypted mood on Sepolia", async function () {
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
    expect(dates.length).to.eq(1);
  });

  it("should compute and decrypt trend on Sepolia", async function () {
    // Store 7 moods
    for (let i = 1; i <= 7; i++) {
      const encryptedMood = await fhevm
        .createEncryptedInput(moodChainContractAddress, signers.alice.address)
        .add32(i)
        .encrypt();

      const tx = await moodChainContract
        .connect(signers.alice)
        .storeEncryptedMood(encryptedMood.handles[0], encryptedMood.inputProof);
      await tx.wait();
    }

    // Check if trend is computed
    const encryptedTrend = await moodChainContract.connect(signers.alice).getEncryptedTrendHandle();
    expect(encryptedTrend).to.not.eq(ethers.ZeroHash);

    // Decrypt trend
    const clearTrend = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTrend,
      moodChainContractAddress,
      signers.alice,
    );

    expect(clearTrend).to.be.a("bigint");
  });
});




