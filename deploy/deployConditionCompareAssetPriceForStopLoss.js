module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy("ConditionCompareAssetPriceForStopLoss", {
        from: deployer,
        gas: 4000000,
        args: [],
        log: true,
    });
};