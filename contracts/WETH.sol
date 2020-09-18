pragma solidity ^0.6.2;

contract WETH9 {
    function deposit() public payable {
    }
    function withdraw(uint wad) public {
    }

    function approve(address guy, uint wad) public returns (bool) {
        return true;
    }

    function transfer(address dst, uint wad) public returns (bool) {
        return true;
    }

    function transferFrom(address src, address dst, uint wad)
        public
        returns (bool)
    {
        return true;
    }
}