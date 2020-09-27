const { Wallet, ethers } = require("ethers");
const PriceFeedMockETHUSDJson = require("./artifacts/PriceFeedMockETHUSD.json");

async function main() {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8546");
    var wallet = ethers.Wallet.fromMnemonic("cat hunt differ medal dutch guide farm fortune lesson episode post spin"); // Ganache Mnemonic
    wallet = wallet.connect(provider);
    //const { 1: otherWallet } = await ethers.getSigners();
    const signer = await wallet.getAddress();
    const PriceFeedDAIETH = new ethers.ContractFactory(
        PriceFeedMockETHUSDJson.abi,
        PriceFeedMockETHUSDJson.bytecode,
        wallet
    );
    const priceFeedDAIETH = await PriceFeedDAIETH.deploy({
        gasLimit : 400000
    });
    await PriceFeedDAIETH.deployed();
    //console.log(priceFeedDAIETH.address, "ADDRESS of the contract");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });