const { Wallet, ethers } = require("ethers");
const PriceFeedDAIETHJson = require("./artifacts/PriceFeedDAIETH.json");

async function main() {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    var wallet = ethers.Wallet.fromMnemonic("never dolphin sister prepare party sell fiscal palm believe slow combine inch"); // Ganache Mnemonic
    wallet = wallet.connect(provider);
    const signer = await wallet.getAddress();
    const PriceFeedDAIETH = await ethers.ContractFactory.fromSolidity(
        PriceFeedDAIETHJson,
        wallet
    );
    const priceFeedDAIETH = await PriceFeedDAIETH.deploy();
    await priceFeedDAIETH.deployed();
    console.log(priceFeedDAIETH.address, "ADDRESS of the contract");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });