const bre = require("@nomiclabs/buidler");
const { utils } = require("ethers");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    if(bre.network.name === "mainnet") {
        return;
    }

    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    let networkname = bre.network.name;

    let currentNonce = await ethers.provider.getTransactionCount(
        deployer
    );

    if (networkname == "mainnet") {
        console.log("Stop Loss Condition Deployement");
        console.log(
          "\nMAINNET action: are you sure you want to proceed? - hit 'ctrl + c' to abort\n"
        );
        console.log(
          `gasPrice: ${utils.formatUnits(network.config.gasPrice, "gwei")} gwei`
        );
        console.log("currentNonce: ", currentNonce);
        console.log("deployerAddress: ", deployer);
        await sleep(10000);
    }

    await deploy("ConditionCompareAssetPriceForStopLoss", {
        from: deployer,
        args: [],
        log: true,
    });
};