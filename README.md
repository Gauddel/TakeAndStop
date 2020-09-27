# Take&Stop

<p align="center">
  <img width="400" height="380" src="https://raw.githubusercontent.com/Gauddel/TakeAndStop/master/assets/Take%26Stop.png">
</p>

## [Browser Application Repo](https://github.com/Gauddel/TakeAndStopApp)

Take&Stop take care of your DeFi position decentrally and autonomously.
It's can be hard to keep track of your DeFi position, and act with no delay as the market evolved to short or to long on DeFi asset.

## Take&Stop Solution

There are multiple solution to tackle this issue, each are their own pros and cons.

- One of the solution, it's by using a bot for automatically send transaction during market move. The backdraw of that solution is that you need to have some developer skill to manage your own bot.
- The second solution it's by delegating this task to a third party. This third party can be trust?
- The best solution, it's using Take&Stop. 

With Take&Stop don't need to be an developer or have trust on third party to keep track of your position.

## Technologies
- Geloto
- InstaDapp
- Uniswap

## For Developer

### Mainnet Deployement
- [Stop Loss Condition Contract](https://etherscan.io/address/0xed9d452d1755160fecd6492270bb67f455b6b78e).
- [ETH/USD Price Feeder](https://etherscan.io/address/0xb02aff0c00a60aeb06a7b12c82214e08ccd5499f).

### Test Task&Stop
`1_get_back_to_fiat_during_bear_market_DAI_ETH`

This is the ordered steps followed by this test :

- Send 10 ethers to the DeFi Smart Account.
- Define the Stop Loss condition with a limit value. When the market price of DAI/ETH hit this limit, that will triggers a action for shorting the position.
- Define shorting action, this action is a call to Uniswap DEX.
- Define the provider for the gelato protocol. The provider is the account that will be charged for future action.
- Stack on gelato protocol as Executor with the ethereum user account.
- Define the executor of the provider. And in the same transaction, stake as provider that will allow future user to execute action.
- Submit condition and the associated actions.
- Monitor price movement. The price movement has been mocked as in the second check the conditional limit as been hit.
- Triggers Action as Executor on the gelato protocol.


`2_get_back_to_fiat_during_bear_market_ETH_USD`

Same as `1_get_back_to_fiat_during_bear_market_DAI_ETH`, but using ETH/USD instead of DAI/ETH asset to decide if we need to short the position.

`5_get_back_to_fiat_during_bear_market_ETH_USD_with_Balance_Condition`

Same as `2_get_back_to_fiat_during_bear_market_ETH_USD`, with balance check before executing action autonomously.
### Run Test
Run test :
```
npx buidler test
```

