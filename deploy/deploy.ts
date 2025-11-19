import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedMoodChain = await deploy("MoodChain", {
    from: deployer,
    log: true,
  });

  console.log(`MoodChain contract: `, deployedMoodChain.address);
};
export default func;
func.id = "deploy_moodChain"; // id required to prevent reexecution
func.tags = ["MoodChain"];




