const { expect } = require("chai");
const bre = require("@nomiclabs/buidler");
const { ethers } = bre;

describe("Unit testing Stop Loss Condition contract", function() {
    this.timeout(0);
    if(bre.network.name !== "ganache") {
        console.error("Test Suite is meant to be run on ganache only");
        process.exit(1);
    }

    let stopLossCondition;
    let priceFeed;

    // Mock For Test Purpose
    let compare;

    before(async function() {
        // Get Test Wallet for local testnet
        [userWallet] = await ethers.getSigners();
        userAddress = await userWallet.getAddress();

        // Ganache default accounts prefilled with 100 ETH
        expect(await userWallet.getBalance()).to.be.gt(ethers.utils.parseEther("10"));

        // ========== Test Setup ============

        const StopLossCondition = await ethers.getContractFactory(
            "ConditionCompareAssetPriceForStopLoss"
        );

        stopLossCondition = await StopLossCondition.deploy();
        await stopLossCondition.deployed();

        const PriceFeed = await ethers.getContractFactory(
            "PriceFeedMockETHUSD"
        );

        priceFeed = await PriceFeed.deploy();
        await priceFeed.deployed();

        let Compare = await ethers.getContractFactory(
            "Compare"
        );
        compare = await Compare.deploy();
        await compare.deployed();
    })

    it("getConditionData should return the encoded data of (address, bytes, uint)", async function() {
        var address = priceFeed.address;
        var data = await bre.run("abi-encode-withselector", {
            abi: require("../artifacts/PriceFeedMockETHUSD.json").abi,
            functionname: "getLatestPriceToken1",
         });
        var limit = String(ethers.utils.parseEther("300"));
        var encoder = new ethers.utils.AbiCoder();
        var expectedResult = encoder.encode(["address", "bytes", "uint256"], [address, data, limit]);

        var actualResult = await stopLossCondition.getConditionData(address, data, limit);

        var isSame = await compare.compareBytes(expectedResult, actualResult);
        expect(isSame).to.be.true;
    })

    it("ok should return error message when static call to pricefeeder isn't successful", async function() {
        // Wrong Address so should failed with error message.
        var address = "0x37A7009d424951dd5D5F155fA588D9a03C455163"; // Gelato Core contract address
        var data = await bre.run("abi-encode-withselector", {
            abi: require("../artifacts/PriceFeedMockETHUSD.json").abi,
            functionname: "getLatestPriceToken1", 
         });
        var limit = String(ethers.utils.parseEther("300"));
        var conditionData = await stopLossCondition.getConditionData(address, data, limit);
        var actualFailureMessage = await stopLossCondition.ok(0, conditionData, 0);
        var expectedFailureMessage = "ConditionCompareAssetPrice.stopLoss._source:UnexpectedReturndata";
        expect(actualFailureMessage).to.be.equal(expectedFailureMessage);
    })

    it("ok should return NotOKPriceStillGreaterThanTheStopLossLimit when limit are not reach.", async function() {
        var address = priceFeed.address;
        var data = await bre.run("abi-encode-withselector", {
            abi: require("../artifacts/PriceFeedMockETHUSD.json").abi,
            functionname: "getLatestPriceToken0", 
         });
        var limit = String(ethers.utils.parseEther("300"));
        var conditionData = await stopLossCondition.getConditionData(address, data, limit);
        var actualFailureMessage = await stopLossCondition.ok(0, conditionData, 0);
        var expectedFailureMessage = "NotOKPriceStillGreaterThanTheStopLossLimit";
        expect(actualFailureMessage).to.be.equal(expectedFailureMessage);
    })

    it("ok should return ok when static call have been successfully called and limit have been reached.", async function() {
        var address = priceFeed.address;
        var data = await bre.run("abi-encode-withselector", {
            abi: require("../artifacts/PriceFeedMockETHUSD.json").abi,
            functionname: "getLatestPriceToken0", 
         });
        var limit = String(ethers.utils.parseEther("300"));
        var conditionData = await stopLossCondition.getConditionData(address, data, limit);

         // Mock priceFeeder
         await priceFeed.mock(ethers.utils.parseEther("90")); // decrease to actual real price - 90 dollars

        var actualMessage = await stopLossCondition.ok(0, conditionData, 0);
        var expectedMessage = "OK";
        expect(actualMessage).to.be.equal(expectedMessage);
    })
})