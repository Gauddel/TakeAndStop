const { expect } = require("chai");
const bre = require("@nomiclabs/buidler");
const { ethers } = bre;
const GelatoCoreLib = require("@gelatonetwork/core");

// Contracts
const InstaIndex = require("../pre-compiles/InstaIndex.json");
const InstaList = require("../pre-compiles/InstaList.json");
const InstaAccount = require("../pre-compiles/InstaAccount.json");
const ConnectUniswapV2 = require("../pre-compiles/ConnectUniswapV2.json");
const ConnectGelato = require("../pre-compiles/ConnectGelato.json");
const ConnectAuth = require("../pre-compiles/ConnectAuth.json");
const ProviderModuleDSA = require("../pre-compiles/ProviderModuleDSA.json");
const WETH = require("../artifacts/WETH.json");
const IERC20 = require("../pre-compiles/IERC20.json");

describe("Stop Loss strategy for ETH/USD decrease, and we own some Ether on our portfolio", function() {
    this.timeout(0);
    if(bre.network.name !== "ganache") {
        console.error("Test Suite is meant to be run on ganache only");
        process.exit(1);
    }

    // Wallet to use for local testing
    let userWallet;
    let userAddress;
    let dsaAddress;

    // Deployed instances
    let connectUniswapV2;
    let connectGelato;
    let uniswapPriceOracle;

    // Contracts to deploy and use for local testing
    let dsa;
    let priceFeedMock;
    let conditionCompareAssetPriceForStopLoss;

    
    before(async function() {
        // Get Test Wallet for local testnet
        [userWallet] = await ethers.getSigners();
        userAddress = await userWallet.getAddress();
        
        // Ganache default accounts prefilled with 100 ETH
        expect(await userWallet.getBalance()).to.be.gt(ethers.utils.parseEther("10"));

        // ===== DSA SETUP ==================
        const instaIndex = await ethers.getContractAt(
            InstaIndex.abi,
            bre.network.config.InstaIndex
        );
        const instaList = await ethers.getContractAt(
            InstaList.abi,
            bre.network.config.InstaList
        );
        connectUniswapV2 = await ethers.getContractAt(
            ConnectUniswapV2.abi,
            bre.network.config.ConnectUniswapV2
        );
        connectGelato = await ethers.getContractAt(
            ConnectGelato.abi,
            bre.network.config.ConnectGelato
        );

        // Deploy DSA and get and verify ID of newly deployed DSA
        const dsaIDPrevious = await instaList.accounts();
        await expect(instaIndex.build(userAddress, 1, userAddress)).to.emit(
            instaIndex,
            "LogAccountCreated"
        );
        const dsaID = dsaIDPrevious.add(1);
        await expect(await instaList.accounts()).to.be.equal(dsaID);

        // Instantiate the DSA
        dsaAddress = await instaList.accountAddr(dsaID);
        dsa = await ethers.getContractAt(InstaAccount.abi, dsaAddress);

        // ===== GELATO SETUP ==================
        gelatoCore = await ethers.getContractAt(
            GelatoCoreLib.GelatoCore.abi,
            bre.network.config.GelatoCore
        );

        // Add GelatoCore as auth on DSA
        const addAuthData = await bre.run("abi-encode-withselector", {
            abi: ConnectAuth.abi,
            functionname: "add",
            inputs: [gelatoCore.address],
        });
        await dsa.cast(
            [bre.network.config.ConnectAuth],
            [addAuthData],
            userAddress
        );
        expect(await dsa.isAuth(gelatoCore.address)).to.be.true;

        // Deploy ProviderModuleDSA to local testnet
        providerModuleDSA = await ethers.getContractAt(
            ProviderModuleDSA.abi,
            bre.network.config.ProviderModuleDSA
        );

        // Deploy Mocks for Testing
        const UniswapPriceOracle = await ethers.getContractFactory(
            "UniswapPriceOracle"
        )
        uniswapPriceOracle = await UniswapPriceOracle.deploy();
        await uniswapPriceOracle.deployed();

        const PriceFeedMock = await ethers.getContractFactory(
            "PriceFeedMockETHUSD"
        );
        priceFeedMock = await PriceFeedMock.deploy();
        await priceFeedMock.deployed();

        const ConditionCompareAssetPriceForStopLoss = await ethers.getContractFactory(
            "ConditionCompareAssetPriceForStopLoss"
        );
        conditionCompareAssetPriceForStopLoss = await ConditionCompareAssetPriceForStopLoss.deploy();
        await conditionCompareAssetPriceForStopLoss.deployed();
    })

    it("Stop Loss if Ether price is too low against USD", async function() {

        await userWallet.sendTransaction({
            to: dsa.address,
            value: ethers.utils.parseEther("10"),
        });
        expect(await ethers.provider.getBalance(dsa.address)).to.be.equal(ethers.utils.parseEther("10"))

        const limit = BigInt(await priceFeedMock.getLatestPriceToken0()) - BigInt("10000000000000000000"); // 300 USD

        const stopLossCondition = new GelatoCoreLib.Condition({
             inst: conditionCompareAssetPriceForStopLoss.address,
             data: await conditionCompareAssetPriceForStopLoss.getConditionData(
                 priceFeedMock.address,
                 await bre.run("abi-encode-withselector", {
                    abi: require("../artifacts/PriceFeedMockETHUSD.json").abi,
                    functionname: "getLatestPriceToken0",
                 }),
                 limit
             ),
        });

        // ======= Action/Spells setup ======
        const spells = [];

        var ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; // Reference of Ether token on instadapp
        var sellAmount = ethers.utils.parseEther("10"); // 10 ether
        var unitAmt = "10000000000000000";
        const sellPositionAction = new GelatoCoreLib.Action({
            addr: connectUniswapV2.address,
            data: await bre.run("abi-encode-withselector", {
                abi : ConnectUniswapV2.abi,
                functionname: "sell",
                inputs: [bre.network.config.DAI, ETH, sellAmount, unitAmt, 0, 0], // 
            }),
            operation: GelatoCoreLib.Operation.Delegatecall,
        });

        spells.push(sellPositionAction);

        // ======= Gelato Task Setup =========
        // A Gelato Task just combines Conditions with Actions
        // You also specify how much GAS a Task consumes at max and the ceiling
        // gas price under which you are willing to auto-transact. There is only
        // one gas price in the current Gelato system: fast gwei read from Chainlink.
        const GAS_LIMIT = "4000000";
        const GAS_PRICE_CEIL = ethers.utils.parseUnits("1000", "gwei");
        const stopLossIfEtherPriceTooLow = new GelatoCoreLib.Task({
            conditions: [stopLossCondition],
            actions: spells,
            selfProviderGasLimit: GAS_LIMIT,
            selfProviderGasPriceCeil: GAS_PRICE_CEIL,
        });

        // ======= Gelato Provider setup ======
        // Someone needs to pay for gas for automatic Task execution on Gelato.
        // Gelato has the concept of a "Provider" to denote who is providing (depositing)
        // ETH on Gelato in order to pay for automation gas. In our case, the User
        // is paying for his own automation gas. Therefore, the User is a "Self-Provider".
        // But since Gelato only talks to smart contract accounts, the User's DSA proxy
        // plays the part of the "Self-Provider" on behalf of the User behind the DSA.
        // A GelatoProvider is an object with the address of the provider - in our case
        // the DSA address - and the address of the "ProviderModule". This module
        // fulfills certain functions like encoding the execution payload for the Gelato
        // protocol. Check out ./contracts/ProviderModuleDSA.sol to see what it does.
        const gelatoSelfProvider = new GelatoCoreLib.GelatoProvider({
            addr: dsa.address,
            module: providerModuleDSA.address,
        });

        // ======= Executor Setup =========
        // For local Testing purposes our test User account will play the role of the Gelato
        // Executor network because this logic is non-trivial to fork into a local instance
        await gelatoCore.stakeExecutor({
            value: await gelatoCore.minExecutorStake(),
        });
        expect(await gelatoCore.isExecutorMinStaked(userAddress)).to.be.true;

        // ======= Gelato Task Provision =========
        // Gelato requires some initial setup via its multiProvide API
        // We must 1) provide ETH to pay for future automation gas, 2) we must
        // assign an Executor network to the Task, 3) we must tell Gelato what
        // "ProviderModule" we want to use for our Task.
        // Since our DSA proxy is the one through which we interact with Gelato,
        // we must do this setup via the DSA proxy by using ConnectGelato
        const TASK_AUTOMATION_FUNDS = await gelatoCore.minExecProviderFunds(
            GAS_LIMIT,
            GAS_PRICE_CEIL
        );
        await dsa.cast(
            [connectGelato.address], // targets
            [
              await bre.run("abi-encode-withselector", {
                abi: ConnectGelato.abi,
                functionname: "multiProvide",
                inputs: [
                  userAddress,
                  [],
                  [providerModuleDSA.address],
                  TASK_AUTOMATION_FUNDS,
                  0,
                  0,
                ],
              }),
            ], // datas
            userAddress, // origin
            {
              value: TASK_AUTOMATION_FUNDS,
              gasLimit: 5000000,
            }
        );
        expect(await gelatoCore.providerFunds(dsa.address)).to.be.gte(
            TASK_AUTOMATION_FUNDS
        );
        expect(
            await gelatoCore.isProviderLiquid(dsa.address, GAS_LIMIT, GAS_PRICE_CEIL)
        );
        expect(await gelatoCore.executorByProvider(dsa.address)).to.be.equal(
            userAddress
        );
        expect(
            await gelatoCore.isModuleProvided(dsa.address, providerModuleDSA.address)
        ).to.be.true;

        // ======= 📣 TASK SUBMISSION 📣 =========
        // In Gelato world our DSA is the User. So we must submit the Task
        // to Gelato via our DSA and hence use ConnectGelato again.
        const expiryDate = 0;
        await expect(
            dsa.cast(
              [connectGelato.address], // targets
              [
                await bre.run("abi-encode-withselector", {
                  abi: ConnectGelato.abi,
                  functionname: "submitTask",
                  inputs: [
                    gelatoSelfProvider,
                    stopLossIfEtherPriceTooLow,
                    expiryDate,
                  ],
                }),
              ], // datas
              userAddress, // origin
              {
                gasLimit: 5000000,
              }
            )
        ).to.emit(gelatoCore, "LogTaskSubmitted");

        // Task Receipt: a successfully submitted Task in Gelato
        // is wrapped in a TaskReceipt. For testing we instantiate the TaskReceipt
        // for our to be submitted Task.
        const taskReceiptId = await gelatoCore.currentTaskReceiptId();
        const taskReceipt = new GelatoCoreLib.TaskReceipt({
        id: taskReceiptId,
        userProxy: dsa.address,
        provider: gelatoSelfProvider,
        tasks: [stopLossIfEtherPriceTooLow],
        expiryDate,
        });

        // ======= 📣 TASK EXECUTION 📣 =========
        // This stuff is normally automated by the Gelato Network and Dapp Developers
        // and their Users don't have to take care of it. However, for local testing
        // we simulate the Gelato Execution logic.

        // First we fetch the gelatoGasPrice as fed by ChainLink oracle. Gelato
        // allows Users to specify a maximum fast gwei gas price for their Tasks
        // to remain executable up until.
        const gelatoGasPrice = await bre.run("fetchGelatoGasPrice");
        expect(gelatoGasPrice).to.be.lte(
            stopLossIfEtherPriceTooLow.selfProviderGasPriceCeil
        );

        // Let's first check if our Task is executable. Since both MockDSR and MockCDAI
        // start with a normalized per second rate of APY_2_PERCENT_IN_SECONDS
        // (1000000000627937192491029810 in 10**27 precision) in both of them, we
        // expect ConditionNotOk because ANotGreaterOrEqualToBbyMinspread.
        // Check out contracts/ConditionCompareUintsFromTwoSources.sol to see how
        // how the comparison of MockDSR and MockCDAI is implemented in Condition code.
        expect(
            await gelatoCore.canExec(
            taskReceipt,
            stopLossIfEtherPriceTooLow.selfProviderGasLimit,
            gelatoGasPrice
            )
        ).to.be.equal("ConditionNotOk:NotOKPriceStillGreaterThanTheStopLossLimit");

        const adjustmentValue = ethers.utils.parseEther("11"); // 290 USD

        await priceFeedMock.mock(adjustmentValue);

        var expectedNewPrice = String(BigInt(limit) - BigInt(ethers.utils.parseEther("1")));
        expect(await priceFeedMock.getLatestPriceToken0()).to.be.equal(expectedNewPrice);

        expect(
            await gelatoCore.canExec(
            taskReceipt,
            stopLossIfEtherPriceTooLow.selfProviderGasLimit,
            gelatoGasPrice
            )
        ).to.be.equal("OK");

        const daiToken = await ethers.getContractAt(
            IERC20.abi,
            bre.network.config.DAI
        );

        const dsaDAIBefore = await daiToken.balanceOf(dsa.address);
        expect(dsaDAIBefore).to.be.equal(0);

        // Take the expected before calling exec, because the exec will change the uniswap market price.
        var expectedSellPrice = await uniswapPriceOracle.getPrice(
            bre.network.config.DAI,
            bre.network.config.WETH,
            String(await ethers.utils.parseEther("10")));

        // For testing we now simulate automatic Task Execution ❗
        await expect(
            gelatoCore.exec(taskReceipt, {
            gasPrice: gelatoGasPrice, // Exectutor must use gelatoGasPrice (Chainlink fast gwei)
            gasLimit: stopLossIfEtherPriceTooLow.selfProviderGasLimit,
            })
        ).to.emit(gelatoCore, "LogExecSuccess");

        expect(await daiToken.balanceOf(dsa.address)).to.be.equal(String(expectedSellPrice));
    })
})
