const assert = require("assert");
const { utils } = require("ethers");

const GelatoCoreLib = require("@gelatonetwork/core");

require("dotenv").config();
const INFURA_ID = process.env.INFURA_ID;
const USER_PK_MAINNET = process.env.USER_PK_MAINNET;
assert.ok(INFURA_ID, "no Infura ID in process.env");

// ================================= CONFIG =========================================
module.exports = {
  defaultNetwork: "ganache",
  etherscan: {
    // The url for the Etherscan API you want to use.
    // For example, here we're using the one for the Rinkeby test network
    url: "https://api.etherscan.io/api",
    // Your API key for Etherscan (Obtain one at https://etherscan.io/)
    apiKey: process.env.ETHERSCAN_KEY,
  },
  networks: {
    ganache: {
      // accounts: { secretKey: USER_PK_MAINNET, balance: '56BC75E2D63100000'}, // Uncomment when buidler will support ganache account.
      // Standard config
      url: "http://localhost:8545",
      fork: `https://mainnet.infura.io/v3/${INFURA_ID}`,
      // Custom
      GelatoCore: "0x1d681d76ce96E4d70a88A00EBbcfc1E47808d0b8",
      ConnectGelato: "0x37A7009d424951dd5D5F155fA588D9a03C455163",
      InstaIndex: "0x2971AdFa57b20E5a416aE5a708A8655A9c74f723",
      InstaList: "0x4c8a1BEb8a87765788946D6B19C6C6355194AbEb",
      InstaConnectors: "0xD6A602C01a023B98Ecfb29Df02FBA380d3B21E0c",
      InstaAccount: "0x939Daad09fC4A9B8f8A9352A485DAb2df4F4B3F8",
      ConnectAuth: "0xd1aFf9f2aCf800C876c409100D6F39AEa93Fc3D9",
      ConnectBasic: "0x6a31c5982C5Bc5533432913cf06a66b6D3333a95",
      ConnectUniswapV2: "0x62EbfF47B2Ba3e47796efaE7C51676762dC961c0",
      ConditionBalance: "0xd69DB9852bAbf9e0bd73B8A090382573C7488154",
      PriceFeed: "0xB02aFF0C00a60AeB06A7b12c82214e08cCD5499f",
      ConditionCompareAssetPriceForStopLoss: "0xEd9D452D1755160FeCd6492270Bb67F455b6b78E",
      DAI: "0x6b175474e89094c44da98b954eedeac495271d0f",
      // DAI_UNISWAP: "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11", // UNISWAP V2 ETH/DAI UniswapV2Pair Address
      WETH: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      DAIETHChainLinkAggregator: "0x773616E4d11A78F511299002da57A0a94577F1f4",
      ProviderModuleDSA: "0x0C25452d20cdFeEd2983fa9b9b9Cf4E81D6f2fE2"
    },
    mainnet: {
      // Standard
      accounts: USER_PK_MAINNET ? [USER_PK_MAINNET] : [],
      chainId: 1,
      url: `https://mainnet.infura.io/v3/${INFURA_ID}`,
      gasPrice: parseInt(utils.parseUnits("60", "gwei"))
    },
    rinkeby: {
      // Standard
      accounts: USER_PK_MAINNET ? [USER_PK_MAINNET] : [],
      chainId: 4,
      url: `https://rinkeby.infura.io/v3/${INFURA_ID}`
    }
  },
  solc: {
    version: "0.6.12",
    optimizer: { enabled: true },
  },
  paths: {
    deploy: 'deploy'
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
  },
};

// ================================= PLUGINS =========================================
usePlugin("@nomiclabs/buidler-ethers");
usePlugin("@nomiclabs/buidler-ganache");
usePlugin("@nomiclabs/buidler-waffle");
usePlugin("buidler-deploy");
usePlugin("@nomiclabs/buidler-etherscan");

// ================================= TASKS =========================================
task("abi-encode-withselector")
  .addPositionalParam(
    "abi",
    "Contract ABI in array form",
    undefined,
    types.json
  )
  .addPositionalParam("functionname")
  .addOptionalVariadicPositionalParam(
    "inputs",
    "Array of function params",
    undefined,
    types.json
  )
  .addFlag("log")
  .setAction(async (taskArgs) => {
    try {
      if (taskArgs.log) console.log(taskArgs);

      if (!taskArgs.abi)
        throw new Error("abi-encode-withselector: no abi passed");

      const interFace = new utils.Interface(taskArgs.abi);

      let functionFragment;
      try {
        functionFragment = interFace.getFunction(taskArgs.functionname);
      } catch (error) {
        throw new Error(
          `\n ❌ abi-encode-withselector: functionname "${taskArgs.functionname}" not found`
        );
      }

      let payloadWithSelector;

      if (taskArgs.inputs) {
        let iterableInputs;
        try {
          iterableInputs = [...taskArgs.inputs];
        } catch (error) {
          iterableInputs = [taskArgs.inputs];
        }
        payloadWithSelector = interFace.encodeFunctionData(
          functionFragment,
          iterableInputs
        );
      } else {
        payloadWithSelector = interFace.encodeFunctionData(
          functionFragment,
          []
        );
      }

      if (taskArgs.log)
        console.log(`\nEncodedPayloadWithSelector:\n${payloadWithSelector}\n`);
      return payloadWithSelector;
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

  task(
    "fetchGelatoGasPrice",
    `Returns the current gelato gas price used for calling canExec and exec`
  )
    .addOptionalParam("gelatocoreaddress")
    .addFlag("log", "Logs return values to stdout")
    .setAction(async (taskArgs) => {
      try {
        const gelatoCore = await ethers.getContractAt(
          GelatoCoreLib.GelatoCore.abi,
          taskArgs.gelatocoreaddress
            ? taskArgs.gelatocoreaddress
            : network.config.GelatoCore
        );
  
        const oracleAbi = ["function latestAnswer() view returns (int256)"];
  
        const gelatoGasPriceOracleAddress = await gelatoCore.gelatoGasPriceOracle();
  
        // Get gelatoGasPriceOracleAddress
        const gelatoGasPriceOracle = await ethers.getContractAt(
          oracleAbi,
          gelatoGasPriceOracleAddress
        );
  
        // lastAnswer is used by GelatoGasPriceOracle as well as the Chainlink Oracle
        const gelatoGasPrice = await gelatoGasPriceOracle.latestAnswer();
  
        if (taskArgs.log) {
          console.log(
            `\ngelatoGasPrice: ${utils.formatUnits(
              gelatoGasPrice.toString(),
              "gwei"
            )} gwei\n`
          );
        }
  
        return gelatoGasPrice;
      } catch (error) {
        console.error(error, "\n");
        process.exit(1);
      }
    });
