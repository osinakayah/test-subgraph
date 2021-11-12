import {
  AddCall,
  Deposit,
  TransferOwnershipCall,
  MassUpdatePoolsCall,
  Farming as MasterChefContract,
  OwnershipTransferred,
  SetCall,
  UpdatePoolCall,
  Withdraw
} from '../generated/Farming/Farming'
import { Address, BigDecimal, BigInt, dataSource, ethereum, log } from '@graphprotocol/graph-ts'
import {
  BIG_DECIMAL_1E12,
  BIG_DECIMAL_1E18,
  BIG_DECIMAL_ZERO,
  BIG_INT_ONE,
  BIG_INT_ONE_DAY_SECONDS,
  BIG_INT_ZERO,
  FARMING_ADDRESS,
  FARMING_START_BLOCK
} from 'const'
import { History, MasterChef, Pool, PoolHistory, User } from '../generated/schema'
import { getMoneyPrice, getUSDRate } from 'pricing'

import { ERC20 as ERC20Contract } from '../generated/Farming/ERC20'
import { Core as PairContract } from '../generated/Farming/Core'

function getMasterChef(block: ethereum.Block): MasterChef {
  let masterChef = MasterChef.load(FARMING_ADDRESS.toHex())

  if (masterChef === null) {
    const contract = MasterChefContract.bind(FARMING_ADDRESS)
    masterChef = new MasterChef(FARMING_ADDRESS.toHex())
    // masterChef.bonusMultiplier = contract.BONUS_MULTIPLIER()
    // masterChef.bonusEndBlock = contract.bonusEndBlock()
    masterChef.owner = contract.owner()
    // poolInfo ...
    masterChef.money = contract.money()
    masterChef.totalAllocPoint = contract.totalAllocPoint()
    // userInfo ...
    masterChef.poolCount = BIG_INT_ZERO

    masterChef.hvlpBalance = BIG_DECIMAL_ZERO
    masterChef.hvlpAge = BIG_DECIMAL_ZERO
    masterChef.hvlpAgeRemoved = BIG_DECIMAL_ZERO
    masterChef.hvlpDeposited = BIG_DECIMAL_ZERO
    masterChef.hvlpWithdrawn = BIG_DECIMAL_ZERO

    masterChef.updatedAt = block.timestamp

    masterChef.save()
  }

  return masterChef as MasterChef
}

export function getPool(id: BigInt, block: ethereum.Block): Pool {
  let pool = Pool.load(id.toString())

  if (pool === null) {
    const masterChef = getMasterChef(block)

    const masterChefContract = MasterChefContract.bind(FARMING_ADDRESS)
    const poolLength = masterChefContract.poolLength()

    if (id >= poolLength) {
      return null
    }

    // Create new pool.
    pool = new Pool(id.toString())

    // Set relation
    pool.owner = masterChef.id

    const poolInfo = masterChefContract.poolInfo(masterChef.poolCount)

    pool.pair = poolInfo.value0
    pool.allocPoint = poolInfo.value1
    pool.lastRewardBlock = poolInfo.value2
    pool.accMoneyPerShare = poolInfo.value3

    // Total supply of LP tokens
    pool.balance = BIG_INT_ZERO
    pool.userCount = BIG_INT_ZERO

    pool.hvlpBalance = BIG_DECIMAL_ZERO
    pool.hvlpAge = BIG_DECIMAL_ZERO
    pool.hvlpAgeRemoved = BIG_DECIMAL_ZERO
    pool.hvlpDeposited = BIG_DECIMAL_ZERO
    pool.hvlpWithdrawn = BIG_DECIMAL_ZERO

    pool.timestamp = block.timestamp
    pool.block = block.number

    pool.updatedAt = block.timestamp
    pool.entryUSD = BIG_DECIMAL_ZERO
    pool.exitUSD = BIG_DECIMAL_ZERO
    pool.moneyHarvested = BIG_DECIMAL_ZERO
    pool.moneyHarvestedUSD = BIG_DECIMAL_ZERO
    pool.save()
  }

  return pool as Pool
}

function getHistory(owner: string, block: ethereum.Block): History {
  const day = block.timestamp.div(BIG_INT_ONE_DAY_SECONDS)

  const id = owner.concat(day.toString())

  let history = History.load(id)

  if (history === null) {
    history = new History(id)
    history.owner = owner
    history.hvlpBalance = BIG_DECIMAL_ZERO
    history.hvlpAge = BIG_DECIMAL_ZERO
    history.hvlpAgeRemoved = BIG_DECIMAL_ZERO
    history.hvlpDeposited = BIG_DECIMAL_ZERO
    history.hvlpWithdrawn = BIG_DECIMAL_ZERO
    history.timestamp = block.timestamp
    history.block = block.number
  }

  return history as History
}

function getPoolHistory(pool: Pool, block: ethereum.Block): PoolHistory {
  const day = block.timestamp.div(BIG_INT_ONE_DAY_SECONDS)

  const id = pool.id.concat(day.toString())

  let history = PoolHistory.load(id)

  if (history === null) {
    history = new PoolHistory(id)
    history.pool = pool.id
    history.hvlpBalance = BIG_DECIMAL_ZERO
    history.hvlpAge = BIG_DECIMAL_ZERO
    history.hvlpAgeRemoved = BIG_DECIMAL_ZERO
    history.hvlpDeposited = BIG_DECIMAL_ZERO
    history.hvlpWithdrawn = BIG_DECIMAL_ZERO
    history.timestamp = block.timestamp
    history.block = block.number
    history.entryUSD = BIG_DECIMAL_ZERO
    history.exitUSD = BIG_DECIMAL_ZERO
    history.moneyHarvested = BIG_DECIMAL_ZERO
    history.moneyHarvestedUSD = BIG_DECIMAL_ZERO
  }

  return history as PoolHistory
}

export function getUser(pid: BigInt, address: Address, block: ethereum.Block): User {
  const uid = address.toHex()
  const id = pid.toString().concat('-').concat(uid)

  let user = User.load(id)

  if (user === null) {
    user = new User(id)
    user.pool = null
    user.address = address
    user.amount = BIG_INT_ZERO
    user.rewardDebt = BIG_INT_ZERO
    user.moneyHarvested = BIG_DECIMAL_ZERO
    user.moneyHarvestedUSD = BIG_DECIMAL_ZERO
    user.entryUSD = BIG_DECIMAL_ZERO
    user.exitUSD = BIG_DECIMAL_ZERO
    user.timestamp = block.timestamp
    user.block = block.number
    user.save()
  }

  return user as User
}

export function add(event: AddCall): void {
  const masterChef = getMasterChef(event.block)

  log.info('Add pool #{}', [masterChef.poolCount.toString()])

  const pool = getPool(masterChef.poolCount, event.block)

  if (pool === null) {
    log.error('Pool added with id greater than poolLength, pool #{}', [masterChef.poolCount.toString()])
    return
  }

  // Update MasterChef.
  masterChef.totalAllocPoint = masterChef.totalAllocPoint.plus(pool.allocPoint)
  masterChef.poolCount = masterChef.poolCount.plus(BIG_INT_ONE)
  masterChef.save()
}

// Calls
export function set(call: SetCall): void {
  log.info('Set pool id: {} allocPoint: {} withUpdate: {}', [
    call.inputs._pid.toString(),
    call.inputs._allocPoint.toString(),
    call.inputs._depositFeeBP ? 'true' : 'false'
  ])

  const pool = getPool(call.inputs._pid, call.block)

  const masterChef = getMasterChef(call.block)

  // Update masterchef
  masterChef.totalAllocPoint = masterChef.totalAllocPoint.plus(call.inputs._allocPoint.minus(pool.allocPoint))
  masterChef.save()

  // Update pool
  pool.allocPoint = call.inputs._allocPoint
  pool.save()
}

export function massUpdatePools(call: MassUpdatePoolsCall): void {
  log.info('Mass update pools', [])
}

export function updatePool(call: UpdatePoolCall): void {
  log.info('Update pool id {}', [call.inputs._pid.toString()])

  const masterChef = MasterChefContract.bind(FARMING_ADDRESS)
  const poolInfo = masterChef.poolInfo(call.inputs._pid)
  const pool = getPool(call.inputs._pid, call.block)
  pool.lastRewardBlock = poolInfo.value2
  pool.accMoneyPerShare = poolInfo.value3
  pool.save()
}

export function dev(call: TransferOwnershipCall): void {
  log.info('Dev changed to {}', [call.inputs.newOwner.toHex()])

  const masterChef = getMasterChef(call.block)

  masterChef.owner = call.inputs.newOwner

  masterChef.save()
}

// Events
export function deposit(event: Deposit): void {
  // if (event.params.amount == BIG_INT_ZERO) {
  //   log.info('Deposit zero transaction, input {} hash {}', [
  //     event.transaction.input.toHex(),
  //     event.transaction.hash.toHex(),
  //   ])
  // }

  const amount = event.params.amount.divDecimal(BIG_DECIMAL_1E18)

  /*log.info('{} has deposited {} hvlp tokens to pool #{}', [
    event.params.user.toHex(),
    event.params.amount.toString(),
    event.params.pid.toString(),
  ])*/

  const masterChefContract = MasterChefContract.bind(FARMING_ADDRESS)

  const poolInfo = masterChefContract.poolInfo(event.params.pid)

  const pool = getPool(event.params.pid, event.block)

  const poolHistory = getPoolHistory(pool, event.block)

  const pairContract = PairContract.bind(poolInfo.value0)
  pool.balance = pairContract.balanceOf(FARMING_ADDRESS)

  pool.lastRewardBlock = poolInfo.value2
  pool.accMoneyPerShare = poolInfo.value3

  const poolDays = event.block.timestamp.minus(pool.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  pool.hvlpAge = pool.hvlpAge.plus(poolDays.times(pool.hvlpBalance))

  pool.hvlpDeposited = pool.hvlpDeposited.plus(amount)
  pool.hvlpBalance = pool.hvlpBalance.plus(amount)

  pool.updatedAt = event.block.timestamp

  const userInfo = masterChefContract.userInfo(event.params.pid, event.params.user)

  const user = getUser(event.params.pid, event.params.user, event.block)

  // If not currently in pool and depositing HVLP
  if (!user.pool && event.params.amount.gt(BIG_INT_ZERO)) {
    user.pool = pool.id
    pool.userCount = pool.userCount.plus(BIG_INT_ONE)
  }

  // Calculate SUSHI being paid out
  if (event.block.number.gt(FARMING_START_BLOCK) && user.amount.gt(BIG_INT_ZERO)) {
    const pending = user.amount
      .toBigDecimal()
      .times(pool.accMoneyPerShare.toBigDecimal())
      .div(BIG_DECIMAL_1E12)
      .minus(user.rewardDebt.toBigDecimal())
      .div(BIG_DECIMAL_1E18)
    // log.info('Deposit: User amount is more than zero, we should harvest {} money', [pending.toString()])
    if (pending.gt(BIG_DECIMAL_ZERO)) {
      // log.info('Harvesting {} SUSHI', [pending.toString()])
      const moneyHarvestedUSD = pending.times(getMoneyPrice(event.block))
      user.moneyHarvested = user.moneyHarvested.plus(pending)
      user.moneyHarvestedUSD = user.moneyHarvestedUSD.plus(moneyHarvestedUSD)
      pool.moneyHarvested = pool.moneyHarvested.plus(pending)
      pool.moneyHarvestedUSD = pool.moneyHarvestedUSD.plus(moneyHarvestedUSD)
      poolHistory.moneyHarvested = pool.moneyHarvested
      poolHistory.moneyHarvestedUSD = pool.moneyHarvestedUSD
    }
  }

  user.amount = userInfo.value0
  user.rewardDebt = userInfo.value1

  if (event.params.amount.gt(BIG_INT_ZERO)) {
    const reservesResult = pairContract.try_getReserves()
    if (!reservesResult.reverted) {
      const totalSupply = pairContract.totalSupply()

      const share = amount.div(totalSupply.toBigDecimal())

      const token0Amount = reservesResult.value.value0.toBigDecimal().times(share)

      const token1Amount = reservesResult.value.value1.toBigDecimal().times(share)

      const token0PriceUSD = getUSDRate(pairContract.token0(), event.block)

      const token1PriceUSD = getUSDRate(pairContract.token1(), event.block)

      const token0USD = token0Amount.times(token0PriceUSD)

      const token1USD = token1Amount.times(token1PriceUSD)

      const entryUSD = token0USD.plus(token1USD)

      // log.info(
      //   'Token {} priceUSD: {} reserve: {} amount: {} / Token {} priceUSD: {} reserve: {} amount: {} - hvlp amount: {} total supply: {} share: {}',
      //   [
      //     token0.symbol(),
      //     token0PriceUSD.toString(),
      //     reservesResult.value.value0.toString(),
      //     token0Amount.toString(),
      //     token1.symbol(),
      //     token1PriceUSD.toString(),
      //     reservesResult.value.value1.toString(),
      //     token1Amount.toString(),
      //     amount.toString(),
      //     totalSupply.toString(),
      //     share.toString(),
      //   ]
      // )

      // log.info('User {} has deposited {} HVLP tokens {} {} (${}) and {} {} (${}) at a combined value of ${}', [
      //   user.address.toHex(),
      //   amount.toString(),
      //   token0Amount.toString(),
      //   token0.symbol(),
      //   token0USD.toString(),
      //   token1Amount.toString(),
      //   token1.symbol(),
      //   token1USD.toString(),
      //   entryUSD.toString(),
      // ])

      user.entryUSD = user.entryUSD.plus(entryUSD)

      pool.entryUSD = pool.entryUSD.plus(entryUSD)

      poolHistory.entryUSD = pool.entryUSD
    }
  }

  user.save()
  pool.save()

  const masterChef = getMasterChef(event.block)

  const masterChefDays = event.block.timestamp.minus(masterChef.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  masterChef.hvlpAge = masterChef.hvlpAge.plus(masterChefDays.times(masterChef.hvlpBalance))

  masterChef.hvlpDeposited = masterChef.hvlpDeposited.plus(amount)
  masterChef.hvlpBalance = masterChef.hvlpBalance.plus(amount)

  masterChef.updatedAt = event.block.timestamp
  masterChef.save()

  const history = getHistory(FARMING_ADDRESS.toHex(), event.block)
  history.hvlpAge = masterChef.hvlpAge
  history.hvlpBalance = masterChef.hvlpBalance
  history.hvlpDeposited = history.hvlpDeposited.plus(amount)
  history.save()

  poolHistory.hvlpAge = pool.hvlpAge
  poolHistory.hvlpBalance = pool.balance.divDecimal(BIG_DECIMAL_1E18)
  poolHistory.hvlpDeposited = poolHistory.hvlpDeposited.plus(amount)
  poolHistory.userCount = pool.userCount
  poolHistory.save()
}

export function withdraw(event: Withdraw): void {
  // if (event.params.amount == BIG_INT_ZERO && User.load(event.params.user.toHex()) !== null) {
  //   log.info('Withdrawal zero transaction, input {} hash {}', [
  //     event.transaction.input.toHex(),
  //     event.transaction.hash.toHex(),
  //   ])
  // }

  const amount = event.params.amount.divDecimal(BIG_DECIMAL_1E18)

  // log.info('{} has withdrawn {} hvlp tokens from pool #{}', [
  //   event.params.user.toHex(),
  //   amount.toString(),
  //   event.params.pid.toString(),
  // ])

  const masterChefContract = MasterChefContract.bind(FARMING_ADDRESS)

  const poolInfo = masterChefContract.poolInfo(event.params.pid)

  const pool = getPool(event.params.pid, event.block)

  const poolHistory = getPoolHistory(pool, event.block)

  const pairContract = PairContract.bind(poolInfo.value0)
  pool.balance = pairContract.balanceOf(FARMING_ADDRESS)
  pool.lastRewardBlock = poolInfo.value2
  pool.accMoneyPerShare = poolInfo.value3

  const poolDays = event.block.timestamp.minus(pool.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  const poolAge = pool.hvlpAge.plus(poolDays.times(pool.hvlpBalance))
  const poolAgeRemoved = poolAge.div(pool.hvlpBalance).times(amount)
  pool.hvlpAge = poolAge.minus(poolAgeRemoved)
  pool.hvlpAgeRemoved = pool.hvlpAgeRemoved.plus(poolAgeRemoved)
  pool.hvlpWithdrawn = pool.hvlpWithdrawn.plus(amount)
  pool.hvlpBalance = pool.hvlpBalance.minus(amount)
  pool.updatedAt = event.block.timestamp

  const user = getUser(event.params.pid, event.params.user, event.block)

  if (event.block.number.gt(FARMING_START_BLOCK) && user.amount.gt(BIG_INT_ZERO)) {
    const pending = user.amount
      .toBigDecimal()
      .times(pool.accMoneyPerShare.toBigDecimal())
      .div(BIG_DECIMAL_1E12)
      .minus(user.rewardDebt.toBigDecimal())
      .div(BIG_DECIMAL_1E18)
    // log.info('Withdraw: User amount is more than zero, we should harvest {} money - block: {}', [
    //   pending.toString(),
    //   event.block.number.toString(),
    // ])
    // log.info('SUSHI PRICE {}', [getMoneyPrice(event.block).toString()])
    if (pending.gt(BIG_DECIMAL_ZERO)) {
      // log.info('Harvesting {} SUSHI (CURRENT SUSHI PRICE {})', [
      //   pending.toString(),
      //   getMoneyPrice(event.block).toString(),
      // ])
      const moneyHarvestedUSD = pending.times(getMoneyPrice(event.block))
      user.moneyHarvested = user.moneyHarvested.plus(pending)
      user.moneyHarvestedUSD = user.moneyHarvestedUSD.plus(moneyHarvestedUSD)
      pool.moneyHarvested = pool.moneyHarvested.plus(pending)
      pool.moneyHarvestedUSD = pool.moneyHarvestedUSD.plus(moneyHarvestedUSD)
      poolHistory.moneyHarvested = pool.moneyHarvested
      poolHistory.moneyHarvestedUSD = pool.moneyHarvestedUSD
    }
  }

  const userInfo = masterChefContract.userInfo(event.params.pid, event.params.user)

  user.amount = userInfo.value0
  user.rewardDebt = userInfo.value1

  if (event.params.amount.gt(BIG_INT_ZERO)) {
    const reservesResult = pairContract.try_getReserves()

    if (!reservesResult.reverted) {
      const totalSupply = pairContract.totalSupply()

      const share = amount.div(totalSupply.toBigDecimal())

      const token0Amount = reservesResult.value.value0.toBigDecimal().times(share)

      const token1Amount = reservesResult.value.value1.toBigDecimal().times(share)

      const token0PriceUSD = getUSDRate(pairContract.token0(), event.block)

      const token1PriceUSD = getUSDRate(pairContract.token1(), event.block)

      const token0USD = token0Amount.times(token0PriceUSD)

      const token1USD = token1Amount.times(token1PriceUSD)

      const exitUSD = token0USD.plus(token1USD)

      pool.exitUSD = pool.exitUSD.plus(exitUSD)

      poolHistory.exitUSD = pool.exitUSD

      // log.info('User {} has withdrwn {} HVLP tokens {} {} (${}) and {} {} (${}) at a combined value of ${}', [
      //   user.address.toHex(),
      //   amount.toString(),
      //   token0Amount.toString(),
      //   token0USD.toString(),
      //   pairContract.token0().toHex(),
      //   token1Amount.toString(),
      //   token1USD.toString(),
      //   pairContract.token1().toHex(),
      //   exitUSD.toString(),
      // ])

      user.exitUSD = user.exitUSD.plus(exitUSD)
    } else {
      log.info("Withdraw couldn't get reserves for pair {}", [poolInfo.value0.toHex()])
    }
  }

  // If HVLP amount equals zero, remove from pool and reduce userCount
  if (user.amount.equals(BIG_INT_ZERO)) {
    user.pool = null
    pool.userCount = pool.userCount.minus(BIG_INT_ONE)
  }

  user.save()
  pool.save()

  const masterChef = getMasterChef(event.block)

  const days = event.block.timestamp.minus(masterChef.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  const hvlpAge = masterChef.hvlpAge.plus(days.times(masterChef.hvlpBalance))
  const hvlpAgeRemoved = hvlpAge.div(masterChef.hvlpBalance).times(amount)
  masterChef.hvlpAge = hvlpAge.minus(hvlpAgeRemoved)
  masterChef.hvlpAgeRemoved = masterChef.hvlpAgeRemoved.plus(hvlpAgeRemoved)

  masterChef.hvlpWithdrawn = masterChef.hvlpWithdrawn.plus(amount)
  masterChef.hvlpBalance = masterChef.hvlpBalance.minus(amount)
  masterChef.updatedAt = event.block.timestamp
  masterChef.save()

  const history = getHistory(FARMING_ADDRESS.toHex(), event.block)
  history.hvlpAge = masterChef.hvlpAge
  history.hvlpAgeRemoved = history.hvlpAgeRemoved.plus(hvlpAgeRemoved)
  history.hvlpBalance = masterChef.hvlpBalance
  history.hvlpWithdrawn = history.hvlpWithdrawn.plus(amount)
  history.save()

  poolHistory.hvlpAge = pool.hvlpAge
  poolHistory.hvlpAgeRemoved = poolHistory.hvlpAgeRemoved.plus(hvlpAgeRemoved)
  poolHistory.hvlpBalance = pool.balance.divDecimal(BIG_DECIMAL_1E18)
  poolHistory.hvlpWithdrawn = poolHistory.hvlpWithdrawn.plus(amount)
  poolHistory.userCount = pool.userCount
  poolHistory.save()
}

export function ownershipTransferred(event: OwnershipTransferred): void {
  log.info('Ownership transfered from previous owner: {} to new owner: {}', [
    event.params.previousOwner.toHex(),
    event.params.newOwner.toHex()
  ])
}
