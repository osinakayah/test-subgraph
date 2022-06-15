import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

export const NULL_CALL_RESULT_VALUE = '0x0000000000000000000000000000000000000000000000000000000000000001'

export const ADDRESS_ZERO = Address.fromString('0x0000000000000000000000000000000000000000')

export const BIG_DECIMAL_1E6 = BigDecimal.fromString('1e6')

export const BIG_DECIMAL_1E12 = BigDecimal.fromString('1e12')

export const BIG_DECIMAL_1E18 = BigDecimal.fromString('1e18')

export const BIG_DECIMAL_ZERO = BigDecimal.fromString('0')

export const BIG_DECIMAL_ONE = BigDecimal.fromString('1')

export const BIG_INT_ONE = BigInt.fromI32(1)

export const BIG_INT_TWO = BigInt.fromI32(2)

export const BIG_INT_ONE_HUNDRED = BigInt.fromI32(100)

export const BIG_INT_ONE_DAY_SECONDS = BigInt.fromI32(86400)

export const BIG_INT_ZERO = BigInt.fromI32(0)

export const LOCKUP_POOL_NUMBER = BigInt.fromI32(29)

export const LOCKUP_BLOCK_NUMBER = BigInt.fromI32(11432276)

export const FARMING_START_BLOCK = BigInt.fromI32(11427232)

export const UNISWAP_MONEY_ETH_PAIR_FIRST_LIQUDITY_BLOCK = BigInt.fromI32(11432276)

export const ACC_MONEY_PRECISION = BigInt.fromString('1000000000000')

export const BENTOBOX_DEPOSIT = 'deposit'

export const BENTOBOX_TRANSFER = 'transfer'

export const BENTOBOX_WITHDRAW = 'withdraw'

export const KASHI_PAIR_MEDIUM_RISK_TYPE = 'medium'

export const PAIR_ADD_COLLATERAL = 'addCollateral'

export const PAIR_REMOVE_COLLATERAL = 'removeCollateral'

export const PAIR_ADD_ASSET = 'addAsset'

export const PAIR_REMOVE_ASSET = 'removeAsset'

export const PAIR_BORROW = 'borrow'

export const PAIR_REPAY = 'repay'

export const FACTORY_ADDRESS = Address.fromString(
  '0xae8b490cfeE5956925d81f8A729cF0C2f2C33ba4'
)

export const FARMING_ADDRESS = Address.fromString(
  '0x816822D1AAfD3186873c702a96213fd41884BA38'
)

export const MASTER_CHEF_V2_ADDRESS = Address.fromString('0xef0881ec094552b2e128cf945ef17a6752b4ec5d')

export const MONEY_BAR_ADDRESS = Address.fromString(
  '0x2D3882b6451c93e0707bbF0C4F1F05EeB096afd5'
)

export const MONEY_MAKER_ADDRESS = Address.fromString(
  '0x0000000000000000000000000000000000000000'
)

export const MONEY_TOKEN_ADDRESS = Address.fromString(
  '0xe366ecf71a1a3c57a79f58cd6295437ee9b9b71d'
)

export const MONEY_USDT_PAIR_ADDRESS = Address.fromString(
  '0x0c8f77ffbb337e3cb6d903c64f7abe8db67c74c8'
)

export const XMONEY_USDC_PAIR_ADDRESS = Address.fromString(
  '0x0000000000000000000000000000000000000000'
)

export const XMONEY_WETH_PAIR_ADDRESS = Address.fromString(
  '0x0000000000000000000000000000000000000000'
)

export const MONEY_DISTRIBUTOR_ADDRESS = Address.fromString(
  '0x22661F2f798e2dc8B798fbEEFC0096EC01F65874'
)

export const USDC_WETH_PAIR =
  '0xfa94729ffac2a574a63410639d79ccc5f48a831e'

export const DAI_WETH_PAIR =
  '0xa7641741a30e40b365b43c97b9be6b89e91ebccf'

export const USDT_WETH_PAIR =
  '0xdef1321eea011ee46c84a68f5f7bc2c4d6561e6c'

export const MONEY_USDT_PAIR =
  '0x306b8ac6f134e942ef2a3ba4ff2d9d0c4bdfca40'

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
export const MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString(
  '0'
)

// minimum liquidity for price to get tracked
export const MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('0')

export const WETH_ADDRESS = Address.fromString(
  '0xA3B45B73067fd2282aAB67436747e9b310254EBd'
)

export const HODL_WETH_USDT_PAIR_ADDRESS = Address.fromString(
  '0xdef1321eea011ee46c84a68f5f7bc2c4d6561e6c'
)

export const USDT_ADDRESS = Address.fromString(
  '0x110a13FC3efE6A245B50102D2d79B3E76125Ae83'
)

export const UNISWAP_FACTORY_ADDRESS = Address.fromString(
  '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f'
)

export const UNISWAP_WETH_USDT_PAIR_ADDRESS = Address.fromString(
  '0xE5133CA897f1c5cdd273775EEFB950f3055F125D'
)

export const UNISWAP_MONEY_ETH_PAIR_ADDRESS = Address.fromString(
  '0x316432B6D50a63Be6Ec83E0700bE75e14278c8AA'
)

export const UNISWAP_MONEY_USDT_PAIR_ADDRESS = Address.fromString(
  '0x05dBf042D2dCbBD0552f90980F6d7a9f7dE92e2E'
)

// Bentobox constants
export const BENTOBOX_ADDRESS = Address.fromString(
  '0x0000000000000000000000000000000000000000'
)

export const KASHI_PAIR_MEDIUM_RISK_MASTER_ADDRESS = Address.fromString(
  '0x0000000000000000000000000000000000000000'
)

// MiniChef
export const MINI_CHEF_ADDRESS = Address.fromString(
  '0x0000000000000000000000000000000000000000'
)

export const COMPLEX_REWARDER = Address.fromString(
  '0x0000000000000000000000000000000000000000'
)

export const CONVEX_REWARDERS: Array<Address> = [
  Address.fromString('0x9e01aac4b3e8781a85b21d9d9f848e72af77b362'),
  Address.fromString('0x1fd97b5e5a257b0b9b9a42a96bb8870cbdd1eb79')
]

export const ALCX_REWARDER = Address.fromString('0x7519c93fc5073e15d89131fd38118d73a72370f8')

export const LIDO_REWARDER = Address.fromString('0x75ff3dd673ef9fc459a52e1054db5df2a1101212')

export const NATIVE = Address.fromString(
  '0x0000000000000000000000000000000000000000'
)

export const USDC = '0x0d9c8723b343a8368bebe0b5e89273ff8d712e3c'

export const USDT = '0x110a13fc3efe6a245b50102d2d79b3e76125ae83'

export const DAI = '0xc2118d4d90b274016cb7a54c03ef52e6c537d957'

// export const WHITELIST: string[] = ''.split(',')

export const WHITELIST: string[] = [
  "0xa3b45b73067fd2282aab67436747e9b310254ebd",
  "0xc2118d4d90b274016cb7a54c03ef52e6c537d957",
  "0x0d9c8723b343a8368bebe0b5e89273ff8d712e3c",
  "0x110a13fc3efe6a245b50102d2d79b3e76125ae83",
  "0xe366ecf71a1a3c57a79f58cd6295437ee9b9b71d",
  "0x212e4ff4f9003ef018632a288cbf4bb92962b3b1",
]

// export const WHITELIST: string[] = [
//   "0x471ece3750da237f93b8e339c536989b8978a438",
//   "0xd629eb00deced2a080b7ec630ef6ac117e614f1b",
//   "0x765de816845861e75a25fca122bb6898b8b1282a",
//   "0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73"
// ];

const CUSTOM_BASES = new Map<string, string>()
