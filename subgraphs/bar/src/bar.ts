import {
  ADDRESS_ZERO,
  BIG_DECIMAL_1E18,
  BIG_DECIMAL_1E6,
  BIG_DECIMAL_ZERO,
  BIG_INT_ZERO,
  MONEY_BAR_ADDRESS,
  MONEY_TOKEN_ADDRESS,
  MONEY_USDT_PAIR_ADDRESS
} from 'const'
import { Address, BigDecimal, BigInt, dataSource, ethereum, log } from '@graphprotocol/graph-ts'
import { Bar, History, User } from '../generated/schema'
import { Staking as BarContract, Transfer as TransferEvent } from '../generated/Staking/Staking'

import { Core as PairContract } from '../generated/Staking/Core'
import { MoneyToken as MoneyTokenContract } from '../generated/Staking/MoneyToken'

// TODO: Get averages of multiple money stablecoin pairs
function getMoneyPrice(): BigDecimal {
  const pair = PairContract.bind(MONEY_USDT_PAIR_ADDRESS)
  const reserves = pair.getReserves()
  return reserves.value1.toBigDecimal().times(BIG_DECIMAL_1E18).div(reserves.value0.toBigDecimal()).div(BIG_DECIMAL_1E6)
}

function createBar(block: ethereum.Block): Bar {
  const contract = BarContract.bind(dataSource.address())
  const bar = new Bar(dataSource.address().toHex())
  bar.decimals = contract.decimals()
  bar.name = contract.name()
  bar.money = contract.money()
  bar.symbol = contract.symbol()
  bar.totalSupply = BIG_DECIMAL_ZERO
  bar.moneyStaked = BIG_DECIMAL_ZERO
  bar.moneyStakedUSD = BIG_DECIMAL_ZERO
  bar.moneyHarvested = BIG_DECIMAL_ZERO
  bar.moneyHarvestedUSD = BIG_DECIMAL_ZERO
  bar.xMoneyMinted = BIG_DECIMAL_ZERO
  bar.xMoneyBurned = BIG_DECIMAL_ZERO
  bar.xMoneyAge = BIG_DECIMAL_ZERO
  bar.xMoneyAgeDestroyed = BIG_DECIMAL_ZERO
  bar.ratio = BIG_DECIMAL_ZERO
  bar.updatedAt = block.timestamp
  bar.save()

  return bar as Bar
}

function getBar(block: ethereum.Block): Bar {
  let bar = Bar.load(dataSource.address().toHex())

  if (bar === null) {
    bar = createBar(block)
  }

  return bar as Bar
}

function createUser(address: Address, block: ethereum.Block): User {
  const user = new User(address.toHex())

  // Set relation to bar
  user.bar = dataSource.address().toHex()

  user.xMoney = BIG_DECIMAL_ZERO
  user.xMoneyMinted = BIG_DECIMAL_ZERO
  user.xMoneyBurned = BIG_DECIMAL_ZERO

  user.moneyStaked = BIG_DECIMAL_ZERO
  user.moneyStakedUSD = BIG_DECIMAL_ZERO

  user.moneyHarvested = BIG_DECIMAL_ZERO
  user.moneyHarvestedUSD = BIG_DECIMAL_ZERO

  // In/Out
  user.xMoneyOut = BIG_DECIMAL_ZERO
  user.moneyOut = BIG_DECIMAL_ZERO
  user.usdOut = BIG_DECIMAL_ZERO

  user.xMoneyIn = BIG_DECIMAL_ZERO
  user.moneyIn = BIG_DECIMAL_ZERO
  user.usdIn = BIG_DECIMAL_ZERO

  user.xMoneyAge = BIG_DECIMAL_ZERO
  user.xMoneyAgeDestroyed = BIG_DECIMAL_ZERO

  user.xMoneyOffset = BIG_DECIMAL_ZERO
  user.moneyOffset = BIG_DECIMAL_ZERO
  user.usdOffset = BIG_DECIMAL_ZERO
  user.updatedAt = block.timestamp

  return user as User
}

function getUser(address: Address, block: ethereum.Block): User {
  let user = User.load(address.toHex())

  if (user === null) {
    user = createUser(address, block)
  }

  return user as User
}

function getHistory(block: ethereum.Block): History {
  const day = block.timestamp.toI32() / 86400

  const id = BigInt.fromI32(day).toString()

  let history = History.load(id)

  if (history === null) {
    const date = day * 86400
    history = new History(id)
    history.date = date
    history.timeframe = 'Day'
    history.moneyStaked = BIG_DECIMAL_ZERO
    history.moneyStakedUSD = BIG_DECIMAL_ZERO
    history.moneyHarvested = BIG_DECIMAL_ZERO
    history.moneyHarvestedUSD = BIG_DECIMAL_ZERO
    history.xMoneyAge = BIG_DECIMAL_ZERO
    history.xMoneyAgeDestroyed = BIG_DECIMAL_ZERO
    history.xMoneyMinted = BIG_DECIMAL_ZERO
    history.xMoneyBurned = BIG_DECIMAL_ZERO
    history.xMoneySupply = BIG_DECIMAL_ZERO
    history.ratio = BIG_DECIMAL_ZERO
  }

  return history as History
}

export function transfer(event: TransferEvent): void {

  // Convert to BigDecimal with 18 places, 1e18.
  const value = event.params.value.divDecimal(BIG_DECIMAL_1E18)

  // If value is zero, do nothing.
  if (value.equals(BIG_DECIMAL_ZERO)) {
    log.warning('Transfer zero value! Value: {} Tx: {}', [
      event.params.value.toString(),
      event.transaction.hash.toHex()
    ])
    return
  }

  const bar = getBar(event.block)
  const barContract = BarContract.bind(MONEY_BAR_ADDRESS)

  const moneyPrice = getMoneyPrice()

  bar.totalSupply = barContract.totalSupply().divDecimal(BIG_DECIMAL_1E18)
  bar.moneyStaked = MoneyTokenContract.bind(MONEY_TOKEN_ADDRESS)
    .balanceOf(MONEY_BAR_ADDRESS)
    .divDecimal(BIG_DECIMAL_1E18)
  bar.ratio = bar.moneyStaked.div(bar.totalSupply)

  const what = value.times(bar.ratio)

  // Minted xMoney
  if (event.params.from == ADDRESS_ZERO) {
    const user = getUser(event.params.to, event.block)

    log.info('{} minted {} xMoney in exchange for {} money - moneyStaked before {} moneyStaked after {}', [
      event.params.to.toHex(),
      value.toString(),
      what.toString(),
      user.moneyStaked.toString(),
      user.moneyStaked.plus(what).toString()
    ])

    if (user.xMoney == BIG_DECIMAL_ZERO) {
      log.info('{} entered the bar', [user.id])
      user.bar = bar.id
    }

    user.xMoneyMinted = user.xMoneyMinted.plus(value)

    const moneyStakedUSD = what.times(moneyPrice)

    user.moneyStaked = user.moneyStaked.plus(what)
    user.moneyStakedUSD = user.moneyStakedUSD.plus(moneyStakedUSD)

    const days = event.block.timestamp.minus(user.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    const xMoneyAge = days.times(user.xMoney)

    user.xMoneyAge = user.xMoneyAge.plus(xMoneyAge)

    // Update last
    user.xMoney = user.xMoney.plus(value)

    user.updatedAt = event.block.timestamp

    user.save()

    const barDays = event.block.timestamp.minus(bar.updatedAt).divDecimal(BigDecimal.fromString('86400'))
    const barXmoney = bar.xMoneyMinted.minus(bar.xMoneyBurned)
    bar.xMoneyMinted = bar.xMoneyMinted.plus(value)
    bar.xMoneyAge = bar.xMoneyAge.plus(barDays.times(barXmoney))
    bar.moneyStaked = bar.moneyStaked.plus(what)
    bar.moneyStakedUSD = bar.moneyStakedUSD.plus(moneyStakedUSD)
    bar.updatedAt = event.block.timestamp

    const history = getHistory(event.block)
    history.xMoneyAge = bar.xMoneyAge
    history.xMoneyMinted = history.xMoneyMinted.plus(value)
    history.xMoneySupply = bar.totalSupply
    history.moneyStaked = history.moneyStaked.plus(what)
    history.moneyStakedUSD = history.moneyStakedUSD.plus(moneyStakedUSD)
    history.ratio = bar.ratio
    history.save()
  }

  // Burned xMoney
  if (event.params.to == ADDRESS_ZERO) {
    log.info('{} burned {} xMoney', [event.params.from.toHex(), value.toString()])

    const user = getUser(event.params.from, event.block)

    user.xMoneyBurned = user.xMoneyBurned.plus(value)

    user.moneyHarvested = user.moneyHarvested.plus(what)

    const moneyHarvestedUSD = what.times(moneyPrice)

    user.moneyHarvestedUSD = user.moneyHarvestedUSD.plus(moneyHarvestedUSD)

    const days = event.block.timestamp.minus(user.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    const xMoneyAge = days.times(user.xMoney)

    user.xMoneyAge = user.xMoneyAge.plus(xMoneyAge)

    const xMoneyAgeDestroyed = user.xMoneyAge.div(user.xMoney).times(value)

    user.xMoneyAgeDestroyed = user.xMoneyAgeDestroyed.plus(xMoneyAgeDestroyed)

    // remove xMoneyAge
    user.xMoneyAge = user.xMoneyAge.minus(xMoneyAgeDestroyed)
    // Update xMoney last
    user.xMoney = user.xMoney.minus(value)

    if (user.xMoney == BIG_DECIMAL_ZERO) {
      log.info('{} left the bar', [user.id])
      user.bar = null
    }

    user.updatedAt = event.block.timestamp

    user.save()

    const barDays = event.block.timestamp.minus(bar.updatedAt).divDecimal(BigDecimal.fromString('86400'))
    const barXmoney = bar.xMoneyMinted.minus(bar.xMoneyBurned)
    bar.xMoneyBurned = bar.xMoneyBurned.plus(value)
    bar.xMoneyAge = bar.xMoneyAge.plus(barDays.times(barXmoney)).minus(xMoneyAgeDestroyed)
    bar.xMoneyAgeDestroyed = bar.xMoneyAgeDestroyed.plus(xMoneyAgeDestroyed)
    bar.moneyHarvested = bar.moneyHarvested.plus(what)
    bar.moneyHarvestedUSD = bar.moneyHarvestedUSD.plus(moneyHarvestedUSD)
    bar.updatedAt = event.block.timestamp

    const history = getHistory(event.block)
    history.xMoneySupply = bar.totalSupply
    history.xMoneyBurned = history.xMoneyBurned.plus(value)
    history.xMoneyAge = bar.xMoneyAge
    history.xMoneyAgeDestroyed = history.xMoneyAgeDestroyed.plus(xMoneyAgeDestroyed)
    history.moneyHarvested = history.moneyHarvested.plus(what)
    history.moneyHarvestedUSD = history.moneyHarvestedUSD.plus(moneyHarvestedUSD)
    history.ratio = bar.ratio
    history.save()
  }

  // If transfer from address to address and not known xMoney pools.
  if (event.params.from != ADDRESS_ZERO && event.params.to != ADDRESS_ZERO) {
    log.info('transfered {} xMoney from {} to {}', [
      value.toString(),
      event.params.from.toHex(),
      event.params.to.toHex()
    ])

    const fromUser = getUser(event.params.from, event.block)

    const fromUserDays = event.block.timestamp.minus(fromUser.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    // Recalc xMoney age first
    fromUser.xMoneyAge = fromUser.xMoneyAge.plus(fromUserDays.times(fromUser.xMoney))
    // Calculate xMoneyAge being transfered
    const xMoneyAgeTranfered = fromUser.xMoneyAge.div(fromUser.xMoney).times(value)
    // Subtract from xMoneyAge
    fromUser.xMoneyAge = fromUser.xMoneyAge.minus(xMoneyAgeTranfered)
    fromUser.updatedAt = event.block.timestamp

    fromUser.xMoney = fromUser.xMoney.minus(value)
    fromUser.xMoneyOut = fromUser.xMoneyOut.plus(value)
    fromUser.moneyOut = fromUser.moneyOut.plus(what)
    fromUser.usdOut = fromUser.usdOut.plus(what.times(moneyPrice))

    if (fromUser.xMoney == BIG_DECIMAL_ZERO) {
      log.info('{} left the bar by transfer OUT', [fromUser.id])
      fromUser.bar = null
    }

    fromUser.save()

    const toUser = getUser(event.params.to, event.block)

    if (toUser.bar === null) {
      log.info('{} entered the bar by transfer IN', [fromUser.id])
      toUser.bar = bar.id
    }

    // Recalculate xMoney age and add incoming xMoneyAgeTransfered
    const toUserDays = event.block.timestamp.minus(toUser.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    toUser.xMoneyAge = toUser.xMoneyAge.plus(toUserDays.times(toUser.xMoney)).plus(xMoneyAgeTranfered)
    toUser.updatedAt = event.block.timestamp

    toUser.xMoney = toUser.xMoney.plus(value)
    toUser.xMoneyIn = toUser.xMoneyIn.plus(value)
    toUser.moneyIn = toUser.moneyIn.plus(what)
    toUser.usdIn = toUser.usdIn.plus(what.times(moneyPrice))

    const difference = toUser.xMoneyIn.minus(toUser.xMoneyOut).minus(toUser.xMoneyOffset)

    // If difference of money in - money out - offset > 0, then add on the difference
    // in staked money based on xMoney:Money ratio at time of reciept.
    if (difference.gt(BIG_DECIMAL_ZERO)) {
      const money = toUser.moneyIn.minus(toUser.moneyOut).minus(toUser.moneyOffset)
      const usd = toUser.usdIn.minus(toUser.usdOut).minus(toUser.usdOffset)

      log.info('{} recieved a transfer of {} xMoney from {}, money value of transfer is {}', [
        toUser.id,
        value.toString(),
        fromUser.id,
        what.toString()
      ])

      toUser.moneyStaked = toUser.moneyStaked.plus(money)
      toUser.moneyStakedUSD = toUser.moneyStakedUSD.plus(usd)

      toUser.xMoneyOffset = toUser.xMoneyOffset.plus(difference)
      toUser.moneyOffset = toUser.moneyOffset.plus(money)
      toUser.usdOffset = toUser.usdOffset.plus(usd)
    }

    toUser.save()
  }

  bar.save()
}
