const { expect } = require("chai");
const bre = require("@nomiclabs/buidler");
const { ethers } = bre;

const PriceFeedMockETHUSD = require("../artifacts/PriceFeedMockETHUSD.json");

describe("Unit testing Price Feeder contract for ETH/USD", function() {
    this.timeout(0);
    if(bre.network.name !== "ganache") {
        console.error("Test Suite is meant to be run on ganache only");
        process.exit(1);
    }

    let priceFeed;
    let compare;
    
    beforeEach(async function() {
        // Get Test Wallet for local testnet
        [userWallet] = await ethers.getSigners();
        userAddress = await userWallet.getAddress();

        // Ganache default accounts prefilled with 100 ETH
        expect(await userWallet.getBalance()).to.be.gt(ethers.utils.parseEther("10"));

        // ========== Test Setup ============
        const PriceFeed = await ethers.getContractFactory(
            "PriceFeedMockETHUSD"
        );

        priceFeed = await PriceFeed.deploy();
        await priceFeed.deployed();

        const Compare = await ethers.getContractFactory(
            "Compare"
        );

        compare = await Compare.deploy();
        await compare.deployed();
    });

    it("getLatestPriceToken0 should return how many USD we can purchase for one ETH", async function() {
        var price = await priceFeed.getLatestPriceToken0();
        var minimumPrice = String(ethers.utils.parseEther("300"));
        var isGte = await compare.gteUint(price, minimumPrice);
        expect(isGte).to.be.true;
    })

    it("getLatestPriceToken0 should return the mocked value of USD we can purchase for one ETH", async function() {
        var initialePrice = await priceFeed.getLatestPriceToken0();
        var adjustment = ethers.utils.parseEther("90");
        await priceFeed.mock(adjustment);
        var price = await priceFeed.getLatestPriceToken0();
        var expectedMockedPrice = String(BigInt(initialePrice) - BigInt(adjustment));
        expect(String(price)).to.be.equal(expectedMockedPrice);
    });

    it("getLatestPriceToken1 should return how many ETH we can purchase for one USD", async function() {
        var price = await priceFeed.getLatestPriceToken1();
        var minimumPrice = String(ethers.utils.parseEther("0.002"));
        var isGte = await compare.gteUint(price, minimumPrice);

        expect(isGte).to.be.true;
    })

    it("getLatestPriceToken1 should return the mocked value of ETH we can purchase for one USD", async function() {
        var initialePrice = await priceFeed.getLatestPriceToken1();
        var adjustment = ethers.utils.parseEther("0.0002");
        await priceFeed.mock(adjustment);
        var price = await priceFeed.getLatestPriceToken1();
        var expectedMockedPrice = await compare.substraction(initialePrice, adjustment);

        expect(String(price)).to.be.equal(expectedMockedPrice);
    });

    it("setOracleAddress should set the Chainlink oracle address", async function() {
        var oracleAddress = "0x37A7009d424951dd5D5F155fA588D9a03C455163";
        await priceFeed.setOracleAddress(oracleAddress);

        var actualOracleAddress = await priceFeed.priceFeed();
        expect(actualOracleAddress).to.be.equal(oracleAddress);
    });

    it("setOracleAddress should failed if we try to set another with the same address", async function() {
        var oracleAddress = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
        try {
            await priceFeed.setOracleAddress(oracleAddress)
        } catch (ex) {
            expect(String(ex.data.stack).includes("RuntimeError: VM Exception while processing transaction: revert Price Feeder ETH/USD : Already set.")).to.be.true;
        }
    });

    it("setOracleAddress can be callable only by the owner", async function() {
        const { 1: otherWallet } = await ethers.getSigners();
        var oracleAddress = "0x37A7009d424951dd5D5F155fA588D9a03C455163";
        var priceFeedAddress = priceFeed.address;
        var priceFeedWithSecondSigner = await ethers.getContractAt(PriceFeedMockETHUSD.abi, priceFeedAddress, otherWallet);
        try {
            await priceFeedWithSecondSigner.setOracleAddress(oracleAddress)
        } catch (ex) {
            expect(String(ex.data.stack).includes("RuntimeError: VM Exception while processing transaction: revert Ownable: caller is not the owner")).to.be.true;
        }
    });

    it("unmock should set mockMode property to false", async function() {
        var adjustmentValue = 10;
        await priceFeed.mock(adjustmentValue);
        var initialIsMockMode = await priceFeed.mockMode();
        await priceFeed.unmock();
        var finalIsMockMode = await priceFeed.mockMode();
        expect(initialIsMockMode).to.be.true;
        expect(finalIsMockMode).to.be.false;
    });

    it("unmock can be callable only by the owner", async function() {
        const { 1: otherWallet } = await ethers.getSigners();
        var oracleAddress = "0x37A7009d424951dd5D5F155fA588D9a03C455163";
        var priceFeedAddress = priceFeed.address;
        var priceFeedWithSecondSigner = await ethers.getContractAt(PriceFeedMockETHUSD.abi, priceFeedAddress, otherWallet);
        try {
            await priceFeedWithSecondSigner.unmock();
        } catch (ex) {
            expect(String(ex.data.stack).includes("RuntimeError: VM Exception while processing transaction: revert Ownable: caller is not the owner")).to.be.true;
        }
    });

    it("mock should set mockMode to true and set the new value of adjustment", async function() {
        var expectedAdjustmentValue = 10;
        await priceFeed.mock(expectedAdjustmentValue);
        expect(await priceFeed.adjustmentValue()).to.be.equal(expectedAdjustmentValue);
        expect(await priceFeed.mockMode()).to.be.true;
    });

    it("mock can be callable only by the owner", async function() {
        const { 1: otherWallet } = await ethers.getSigners();
        var priceFeedAddress = priceFeed.address;
        var priceFeedWithSecondSigner = await ethers.getContractAt(PriceFeedMockETHUSD.abi, priceFeedAddress, otherWallet);
        try {
            var adjustmentValue = 10;
            await priceFeedWithSecondSigner.mock(adjustmentValue);
        } catch (ex) {
            expect(String(ex.data.stack).includes("RuntimeError: VM Exception while processing transaction: revert Ownable: caller is not the owner")).to.be.true;
        }
    });
});