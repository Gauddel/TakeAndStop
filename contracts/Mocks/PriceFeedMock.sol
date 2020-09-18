pragma solidity ^0.6.2;

import "./../IPriceFeed.sol";

contract PriceFeedMock {

    IPriceFeed internal priceFeed;
    bool internal mockMode;
    uint internal price;

    constructor(address _priceFeed) public {
        priceFeed = IPriceFeed(_priceFeed);
        mockMode = false;
    }

    function mock(uint _newPrice) public {
        mockMode = true;
        price = _newPrice;
    }

    function getLatestPriceToken0() public view returns (uint) {
        if (mockMode) {
            return price;
        }
        return priceFeed.getLatestPriceToken0();
    }

    function getLatestPriceToken1() public view returns (uint) {
        if (mockMode) {
            return price;
        }
        return priceFeed.getLatestPriceToken1();
    }
}