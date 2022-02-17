/* eslint-disable prefer-const */
import {
  TransferOwnershipCall,
  FarmFactory as FarmFactoryContract,
  OwnershipTransferred,
  NewPool,
  UpdatePool,
  UpdateReserveDistributionScheduleCall,
  SetReserveAddressCall,
  SetFeeAddressCall,
  PullRewardsCall
} from '../generated/FarmFactory/FarmFactory'

import { PoolUpdated, Deposit, Withdraw, Farm as FarmContract } from '../generated/templates/Farm/Farm'
import { Address, BigDecimal, BigInt, ethereum, log } from '@graphprotocol/graph-ts'
import {
  BIG_DECIMAL_1E18,
  BIG_DECIMAL_ONE,
  BIG_DECIMAL_ZERO,
  BIG_INT_ONE,
  BIG_INT_ONE_DAY_SECONDS,
  BIG_INT_ZERO,
  FARMING_ADDRESS,
  FARMING_START_BLOCK
} from 'const'
import { History, Farming, Pool, PoolHistory, User, PoolRounds } from '../generated/schema'
import { Core as PairContract } from '../generated/FarmFactory/Core'

function getMoneyPrice(block: ethereum.Block): BigDecimal {
  return BIG_DECIMAL_ONE
}
function getUSDRate(address: Address, block: ethereum.Block): BigDecimal {
  return BIG_DECIMAL_ONE
}

// Entities initialization and getters
export function getFarming(block: ethereum.Block): Farming {
  let farming = Farming.load(FARMING_ADDRESS.toHex())

  if (farming === null) {
    const contract = FarmFactoryContract.bind(FARMING_ADDRESS)
    farming = new Farming(FARMING_ADDRESS.toHex())
    farming.owner = contract.owner()

    // pool Info ...
    farming.money = contract.money()
    farming.feeAddress = contract.feeAddress()
    farming.reserve = contract.reserve()
    farming.totalAllocPoint = contract.totalAllocPoint()

    farming.reserveDistributionSchedule = contract.reserveDistributionSchedule()
    farming.lastReserveDistributionTimestamp = contract.lastReserveDistributionTimestamp()
    farming.depositPeriod = contract.depositPeriod()
    farming.globalRoundId = contract.globalRoundId()
    farming.rewards = []

    // userInfo ...
    farming.poolCount = BIG_INT_ZERO

    farming.hvlpBalance = BIG_DECIMAL_ZERO
    farming.hvlpAge = BIG_DECIMAL_ZERO
    farming.hvlpAgeRemoved = BIG_DECIMAL_ZERO
    farming.hvlpDeposited = BIG_DECIMAL_ZERO
    farming.hvlpWithdrawn = BIG_DECIMAL_ZERO

    farming.updatedAt = block.timestamp

    farming.save()
  }

  return farming as Farming
}

export function getHistory(owner: string, block: ethereum.Block): History {
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

export function getPool(address: Address, block: ethereum.Block = null): Pool {
  let pool = Pool.load(address.toHex())

  if (pool === null) {
    const poolContract = FarmContract.bind(address)
    let farming = getFarming(block)
    // Create new pool.
    pool = new Pool(address.toHex())

    // Set relation
    pool.owner = farming.id

    pool.pair = poolContract.lpToken()
    pool.poolStartTime = poolContract.poolStartTime()
    pool.globalRoundId = poolContract.globalRoundId()
    pool.allocPoint = poolContract.allocPoint()
    pool.depositFeeBP = BigInt.fromI32(poolContract.depositFeeBP())
    pool.lastRewardBlock = BIG_INT_ZERO
    pool.currentRound = BIG_INT_ZERO

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

export function getPoolRounds(poolAddress: Address, roundId: BigInt, block: ethereum.Block): PoolRounds {
  const id = poolAddress.toString().concat('-').concat(roundId.toString())

  let round = PoolRounds.load(id.toString())

  let farmingContract = FarmContract.bind(poolAddress)
  if (round === null) {
    // Create new pool.
    const pool = new Pool(poolAddress.toHex())
    round = new PoolRounds(id)
    round.pool = pool.id

    round.accMoneyPerShare = farmingContract.getMoneyPerShare(roundId)
    round.deposits = farmingContract.getPoolDeposits(roundId)

    round.userCount = BIG_INT_ZERO
    round.hvlpBalance = BIG_DECIMAL_ZERO
    round.hvlpAge = BIG_DECIMAL_ZERO
    round.hvlpAgeRemoved = BIG_DECIMAL_ZERO
    round.hvlpDeposited = BIG_DECIMAL_ZERO
    round.hvlpWithdrawn = BIG_DECIMAL_ZERO
    round.timestamp = block.timestamp
    round.block = block.number
    round.entryUSD = BIG_DECIMAL_ZERO
    round.exitUSD = BIG_DECIMAL_ZERO
    round.moneyHarvested = BIG_DECIMAL_ZERO
    round.moneyHarvestedUSD = BIG_DECIMAL_ZERO
    round.updatedAt = block.timestamp
  }

  return round as PoolRounds
}

export function getPoolHistory(pool: Pool, block: ethereum.Block): PoolHistory {
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
    user.entryRound = null
    user.amount = BIG_INT_ZERO
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

// Farm Events
export function ownershipTransferred(event: OwnershipTransferred): void {
  log.info('Ownership transfered from previous owner: {} to new owner: {}', [
    event.params.previousOwner.toHex(),
    event.params.newOwner.toHex()
  ])
}

export function add(event: NewPool): void {
  let farming = getFarming(event.block)

  log.info('Add pool #{}', [farming.poolCount.toString()])

  const pool = getPool(event.params.farm, event.block)

  if (pool === null) {
    log.error('Pool added with id greater than poolLength, pool #{}', [farming.poolCount.toString()])
    return
  }

  // Update Farming.
  farming.totalAllocPoint = farming.totalAllocPoint.plus(pool.allocPoint)
  farming.lastReserveDistributionTimestamp = event.block.timestamp
  farming.poolCount = farming.poolCount.plus(BIG_INT_ONE)
  farming.save()
}

export function set(event: UpdatePool): void {
  const pool = getPool(event.params.farm, event.block)

  let farming = getFarming(event.block)

  // Update farming
  farming.totalAllocPoint = farming.totalAllocPoint.plus(event.params.allocPoint.minus(pool.allocPoint))
  farming.save()

  // Update pool
  pool.allocPoint = event.params.allocPoint
  pool.depositFeeBP = BigInt.fromI32(event.params.depositFeeBP)
  pool.save()
}

export function updatePool(event: PoolUpdated): void {
  let farming = FarmContract.bind(event.address)
  const pool = getPool(event.address)

  const lastUpdatedRound = pool.currentRound
  const currentRound = farming.getCurrentRoundId()

  if (lastUpdatedRound === currentRound) {
    return
  }

  let roundUpdated = new BigInt(0)
  for (let index = lastUpdatedRound.plus(new BigInt(1)); index.lt(currentRound); index.plus(new BigInt(1))) {
    const poolRound = getPoolRounds(event.address, index, event.block)

    poolRound.accMoneyPerShare = farming.getMoneyPerShare(index)
    if (poolRound.accMoneyPerShare.gt(new BigInt(0))) roundUpdated = index
    poolRound.save()
  }
  pool.currentRound = roundUpdated
  pool.save()
}

export function deposit(event: Deposit): void {
  if (event.params.amount == BIG_INT_ZERO) {
    log.info('Deposit zero transaction, input {} hash {}', [
      event.transaction.input.toHex(),
      event.transaction.hash.toHex()
    ])
  }

  const amount = event.params.amount.divDecimal(BIG_DECIMAL_1E18)

  log.info('{} has deposited {} hvlp tokens to pool #{}', [event.params.user.toHex(), event.params.amount.toString()])

  const farmContract = FarmContract.bind(event.address)

  let farming = getFarming(event.block)
  const pool = getPool(event.address, event.block)
  const poolRound = getPoolRounds(event.address, event.params.roundId, event.block)
  const poolHistory = getPoolHistory(pool, event.block)

  //update pool rounds
  const poolRoundDays = event.block.timestamp.minus(poolRound.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  poolRound.hvlpAge = poolRound.hvlpAge.plus(poolRoundDays.times(poolRound.hvlpBalance))
  poolRound.hvlpDeposited = poolRound.hvlpDeposited.plus(amount)
  poolRound.hvlpBalance = poolRound.hvlpBalance.plus(amount)
  poolRound.updatedAt = event.block.timestamp

  // update pool
  const pairContract = PairContract.bind(Address.fromString(pool.pair.toHexString()))

  pool.balance = pairContract.balanceOf(FARMING_ADDRESS)

  const poolDays = event.block.timestamp.minus(pool.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  pool.hvlpAge = pool.hvlpAge.plus(poolDays.times(pool.hvlpBalance))
  pool.hvlpDeposited = pool.hvlpDeposited.plus(amount)
  pool.hvlpBalance = pool.hvlpBalance.plus(amount)
  pool.updatedAt = event.block.timestamp

  const userInfo = farmContract.userInfo(event.params.user)

  const user = getUser(farmContract.farmId(), event.params.user, event.block)

  // If not currently in pool and depositing HVLP
  if (!user.pool && event.params.amount.gt(BIG_INT_ZERO)) {
    user.pool = pool.id
    pool.userCount = pool.userCount.plus(BIG_INT_ONE)
    poolRound.userCount = poolRound.userCount.plus(BIG_INT_ONE)
  }

  // Calculate MONEY being paid out
  if (event.block.number.gt(FARMING_START_BLOCK) && user.amount.gt(BIG_INT_ZERO)) {
    const pending = new BigDecimal(event.params.rewards)

    // log.info('Deposit: User amount is more than zero, we should harvest {} money', [pending.toString()])
    if (pending.gt(BIG_DECIMAL_ZERO)) {
      // log.info('Harvesting {} MONEY', [pending.toString()])
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
  user.entryRound = userInfo.value1

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

      user.entryUSD = user.entryUSD.plus(entryUSD)

      pool.entryUSD = pool.entryUSD.plus(entryUSD)

      poolHistory.entryUSD = pool.entryUSD
    }
  }

  pool.currentRound = event.params.roundId

  user.save()
  pool.save()
  poolRound.save()

  let farmingDays = event.block.timestamp.minus(farming.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  farming.hvlpAge = farming.hvlpAge.plus(farmingDays.times(farming.hvlpBalance))

  farming.hvlpDeposited = farming.hvlpDeposited.plus(amount)
  farming.hvlpBalance = farming.hvlpBalance.plus(amount)

  farming.updatedAt = event.block.timestamp
  farming.availableRewards = farmContract.availableRewards()
  farming.save()

  const history = getHistory(FARMING_ADDRESS.toHex(), event.block)
  history.hvlpAge = farming.hvlpAge
  history.hvlpBalance = farming.hvlpBalance
  history.hvlpDeposited = history.hvlpDeposited.plus(amount)
  history.save()

  poolHistory.hvlpAge = pool.hvlpAge
  poolHistory.hvlpBalance = pool.balance.divDecimal(BIG_DECIMAL_1E18)
  poolHistory.hvlpDeposited = poolHistory.hvlpDeposited.plus(amount)
  poolHistory.userCount = pool.userCount
  poolHistory.save()
}

export function withdraw(event: Withdraw): void {
  const amount = event.params.amount.divDecimal(BIG_DECIMAL_1E18)

  log.info('{} has withdrawn {} hvlp tokens from pool #{}', [event.params.user.toHex(), amount.toString()])

  const farmContract = FarmContract.bind(event.address)

  let farming = getFarming(event.block)
  const pool = getPool(event.address, event.block)
  const poolRound = getPoolRounds(event.address, event.params.roundId, event.block)
  const poolHistory = getPoolHistory(pool, event.block)

  const pairContract = PairContract.bind(Address.fromString(pool.pair.toHexString()))
  pool.balance = pairContract.balanceOf(FARMING_ADDRESS)

  const poolDays = event.block.timestamp.minus(pool.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  const poolAge = pool.hvlpAge.plus(poolDays.times(pool.hvlpBalance))
  const poolAgeRemoved = poolAge.div(pool.hvlpBalance).times(amount)
  pool.hvlpAge = poolAge.minus(poolAgeRemoved)
  pool.hvlpAgeRemoved = pool.hvlpAgeRemoved.plus(poolAgeRemoved)
  pool.hvlpWithdrawn = pool.hvlpWithdrawn.plus(amount)
  pool.hvlpBalance = pool.hvlpBalance.minus(amount)
  pool.updatedAt = event.block.timestamp

  const poolRoundDays = event.block.timestamp.minus(poolRound.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  const poolRoundAge = poolRound.hvlpAge.plus(poolRoundDays.times(poolRound.hvlpBalance))
  const poolRoundAgeRemoved = poolRoundAge.div(poolRound.hvlpBalance).times(amount)
  poolRound.hvlpAge = poolRoundAge.minus(poolRoundAgeRemoved)
  poolRound.hvlpAgeRemoved = poolRound.hvlpAgeRemoved.plus(poolRoundAgeRemoved)
  poolRound.hvlpWithdrawn = poolRound.hvlpWithdrawn.plus(amount)
  poolRound.hvlpBalance = poolRound.hvlpBalance.minus(amount)
  poolRound.updatedAt = event.block.timestamp

  const user = getUser(farmContract.farmId(), event.params.user, event.block)

  if (event.block.number.gt(FARMING_START_BLOCK) && user.amount.gt(BIG_INT_ZERO)) {
    const pending = new BigDecimal(event.params.rewards)
    if (pending.gt(BIG_DECIMAL_ZERO)) {
      const moneyHarvestedUSD = pending.times(getMoneyPrice(event.block))
      user.moneyHarvested = user.moneyHarvested.plus(pending)
      user.moneyHarvestedUSD = user.moneyHarvestedUSD.plus(moneyHarvestedUSD)
      pool.moneyHarvested = pool.moneyHarvested.plus(pending)
      pool.moneyHarvestedUSD = pool.moneyHarvestedUSD.plus(moneyHarvestedUSD)
      poolHistory.moneyHarvested = pool.moneyHarvested
      poolHistory.moneyHarvestedUSD = pool.moneyHarvestedUSD
    }
  }

  const userInfo = farmContract.userInfo(event.params.user)

  user.amount = userInfo.value0
  user.entryRound = userInfo.value1

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

      user.exitUSD = user.exitUSD.plus(exitUSD)
    } else {
      log.info("Withdraw couldn't get reserves for pair {}", [pool.pair.toHex()])
    }
  }

  // If HVLP amount equals zero, remove from pool and reduce userCount
  if (user.amount.equals(BIG_INT_ZERO)) {
    user.pool = null
    pool.userCount = pool.userCount.minus(BIG_INT_ONE)
  }

  user.save()
  pool.save()
  poolRound.save()

  const days = event.block.timestamp.minus(farming.updatedAt).divDecimal(BigDecimal.fromString('86400'))
  const hvlpAge = farming.hvlpAge.plus(days.times(farming.hvlpBalance))
  const hvlpAgeRemoved = hvlpAge.div(farming.hvlpBalance).times(amount)
  farming.hvlpAge = hvlpAge.minus(hvlpAgeRemoved)
  farming.hvlpAgeRemoved = farming.hvlpAgeRemoved.plus(hvlpAgeRemoved)

  farming.hvlpWithdrawn = farming.hvlpWithdrawn.plus(amount)
  farming.hvlpBalance = farming.hvlpBalance.minus(amount)
  farming.updatedAt = event.block.timestamp
  farming.availableRewards = farmContract.availableRewards()

  farming.save()

  const history = getHistory(FARMING_ADDRESS.toHex(), event.block)
  history.hvlpAge = farming.hvlpAge
  history.hvlpAgeRemoved = history.hvlpAgeRemoved.plus(hvlpAgeRemoved)
  history.hvlpBalance = farming.hvlpBalance
  history.hvlpWithdrawn = history.hvlpWithdrawn.plus(amount)
  history.save()

  poolHistory.hvlpAge = pool.hvlpAge
  poolHistory.hvlpAgeRemoved = poolHistory.hvlpAgeRemoved.plus(hvlpAgeRemoved)
  poolHistory.hvlpBalance = pool.balance.divDecimal(BIG_DECIMAL_1E18)
  poolHistory.hvlpWithdrawn = poolHistory.hvlpWithdrawn.plus(amount)
  poolHistory.userCount = pool.userCount
  poolHistory.save()
}

// Farm Functions
export function pullRewards(call: PullRewardsCall): void {
  let farming = getFarming(call.block)

  farming.globalRoundId = farming.globalRoundId.plus(new BigInt(1))
  farming.lastReserveDistributionTimestamp = call.block.timestamp
  const rewards = farming.rewards
  rewards.push(call.outputs.rewardAccumulated)
  farming.rewards = rewards

  farming.save()
}

export function transferOwnership(call: TransferOwnershipCall): void {
  log.info('owner changed to {}', [call.inputs.newOwner.toHex()])

  let farming = getFarming(call.block)
  farming.owner = call.inputs.newOwner
  farming.save()
}

export function updateReserveDistributionSchedule(call: UpdateReserveDistributionScheduleCall): void {
  log.info('reserve distribution schedule changed to {}', [call.inputs._reserveDistributionSchedule.toString()])

  let farming = getFarming(call.block)
  farming.reserveDistributionSchedule = call.inputs._reserveDistributionSchedule
  farming.save()
}

export function setReserveAddress(call: SetReserveAddressCall): void {
  log.info('Reserve Address changed to {}', [call.inputs._reserveAddress.toHex()])

  let farming = getFarming(call.block)
  farming.reserve = call.inputs._reserveAddress
  farming.save()
}

export function setFeeAddress(call: SetFeeAddressCall): void {
  log.info('Fee Address changed to {}', [call.inputs._feeAddress.toHex()])

  let farming = getFarming(call.block)
  farming.feeAddress = call.inputs._feeAddress
  farming.save()
}
