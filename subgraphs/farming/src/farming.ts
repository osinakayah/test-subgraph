import {
  AddCall,
  Deposit,
  TransferOwnershipCall,
  MassUpdatePoolsCall,
  Farming as FarmingContract,
  OwnershipTransferred,
  SetCall,
  UpdatePoolCall,
  Withdraw,
  UpdateReserveDistributionScheduleCall,
  SetReserveAddressCall,
  SetFeeAddress,
  SetFeeAddressCall
} from '../generated/Farming/Farming'
import { Address, BigDecimal, BigInt, ethereum, log } from '@graphprotocol/graph-ts'
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
import { History, Farming, Pool, PoolHistory, User, PoolRounds } from '../generated/schema'
import { getMoneyPrice, getUSDRate } from 'pricing'

import { Core as PairContract } from '../generated/Farming/Core'

function getFarming(block: ethereum.Block): Farming {
  let farming = Farming.load(FARMING_ADDRESS.toHex())

  if (farming === null) {
    const contract = FarmingContract.bind(FARMING_ADDRESS)
    farming = new Farming(FARMING_ADDRESS.toHex())
    farming.owner = contract.owner()
    // poolInfo ...
    farming.money = contract.money()
    farming.feeAddress = contract.feeAddress()
    farming.reserve = contract.reserve()
    farming.totalAllocPoint = contract.totalAllocPoint()

    farming.availableRewards = contract.availableRewards()
    farming.reserveDistributionSchedule = contract.reserveDistributionSchedule()
    farming.lastReserveDistributionTimestamp = contract.lastReserveDistributionTimestamp()
    farming.depositPeriod = contract.depositPeriod()
    farming.globalRoundId = contract.globalRoundId()
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

export function transferOwnership(call: TransferOwnershipCall): void {
  log.info('owner changed to {}', [call.inputs.newOwner.toHex()])

  const farming = getFarming(call.block)
  farming.owner = call.inputs.newOwner
  farming.save()
}

export function updateReserveDistributionSchedule(call: UpdateReserveDistributionScheduleCall): void {
  log.info('reserve distribution schedule changed to {}', [call.inputs._reserveDistributionSchedule.toString()])

  const farming = getFarming(call.block)
  farming.reserveDistributionSchedule = call.inputs._reserveDistributionSchedule
  farming.save()
}

export function setReserveAddress(call: SetReserveAddressCall): void {
  log.info('Reserve Address changed to {}', [call.inputs._reserveAddress.toHex()])

  const farming = getFarming(call.block)
  farming.reserve = call.inputs._reserveAddress
  farming.save()
}

export function setFeeAddress(call: SetFeeAddressCall): void {
  log.info('Fee Address changed to {}', [call.inputs._feeAddress.toHex()])

  const farming = getFarming(call.block)
  farming.feeAddress = call.inputs._feeAddress
  farming.save()
}

export function ownershipTransferred(event: OwnershipTransferred): void {
  log.info('Ownership transfered from previous owner: {} to new owner: {}', [
    event.params.previousOwner.toHex(),
    event.params.newOwner.toHex()
  ])
}

export function getPool(id: BigInt, block: ethereum.Block): Pool {
  let pool = Pool.load(id.toString())

  if (pool === null) {
    const farming = getFarming(block)

    const farmingContract = FarmingContract.bind(FARMING_ADDRESS)
    const poolLength = farmingContract.poolLength()

    if (id >= poolLength) {
      return null
    }

    // Create new pool.
    pool = new Pool(id.toString())

    // Set relation
    pool.owner = farming.id

    const poolInfo = farmingContract.poolInfo(farming.poolCount)

    pool.pair = poolInfo.value0
    pool.poolStartTime = poolInfo.value1
    pool.globalRoundId = poolInfo.value2
    pool.allocPoint = poolInfo.value3
    pool.depositFeeBP = poolInfo.value4
    pool.lastRewardBlock = BIG_INT_ZERO

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

function getPoolRounds(pool: Pool, id: BigInt, block: ethereum.Block): PoolRounds {
  const totalRounds = BigInt.fromI32(pool.rounds.length)

  if (totalRounds <= id) {
    return null
  }

  let round = PoolRounds.load(id.toString())

  if (round === null) {
    const farming = getFarming(block)
    const farmingContract = FarmingContract.bind(FARMING_ADDRESS)

    const poolInfo = farmingContract.poolInfo(farming.poolCount)

    // Create new pool.
    pool = new Pool(id.toString())

    round = new PoolRounds(id.toString())
    round.id = id.toString()
    round.pool = pool.id

    round.accMoneyPerShare = poolInfo.toMap()
    round.deposits = BIG_INT_ZERO
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
  }

  return round as PoolRounds
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

// export function add(event: AddCall): void {
//   const farming = getFarming(event.block)

//   log.info('Add pool #{}', [farming.poolCount.toString()])

//   const pool = getPool(farming.poolCount, event.block)

//   if (pool === null) {
//     log.error('Pool added with id greater than poolLength, pool #{}', [farming.poolCount.toString()])
//     return
//   }

//   // Update Farming.
//   farming.totalAllocPoint = farming.totalAllocPoint.plus(pool.allocPoint)
//   farming.poolCount = farming.poolCount.plus(BIG_INT_ONE)
//   farming.save()
// }

// // Calls
// export function set(call: SetCall): void {
//   log.info('Set pool id: {} allocPoint: {} withUpdate: {}', [
//     call.inputs._pid.toString(),
//     call.inputs._allocPoint.toString(),
//     call.inputs._depositFeeBP ? 'true' : 'false'
//   ])

//   const pool = getPool(call.inputs._pid, call.block)

//   const farming = getFarming(call.block)

//   // Update farming
//   farming.totalAllocPoint = farming.totalAllocPoint.plus(call.inputs._allocPoint.minus(pool.allocPoint))
//   farming.save()

//   // Update pool
//   pool.allocPoint = call.inputs._allocPoint
//   pool.save()
// }

// export function massUpdatePools(call: MassUpdatePoolsCall): void {
//   log.info('Mass update pools', [])
// }

// export function updatePool(call: UpdatePoolCall): void {
//   log.info('Update pool id {}', [call.inputs._pid.toString()])

//   const farming = FarmingContract.bind(FARMING_ADDRESS)
//   const poolInfo = farming.poolInfo(call.inputs._pid)
//   const pool = getPool(call.inputs._pid, call.block)
//   pool.lastRewardBlock = poolInfo.value2
//   pool.accMoneyPerShare = poolInfo.value3
//   pool.save()
// }

// // Events
// export function deposit(event: Deposit): void {
//   // if (event.params.amount == BIG_INT_ZERO) {
//   //   log.info('Deposit zero transaction, input {} hash {}', [
//   //     event.transaction.input.toHex(),
//   //     event.transaction.hash.toHex(),
//   //   ])
//   // }

//   const amount = event.params.amount.divDecimal(BIG_DECIMAL_1E18)

//   /*log.info('{} has deposited {} hvlp tokens to pool #{}', [
//     event.params.user.toHex(),
//     event.params.amount.toString(),
//     event.params.pid.toString(),
//   ])*/

//   const farmingContract = FarmingContract.bind(FARMING_ADDRESS)

//   const poolInfo = farmingContract.poolInfo(event.params.pid)

//   const pool = getPool(event.params.pid, event.block)

//   const poolHistory = getPoolHistory(pool, event.block)

//   const pairContract = PairContract.bind(poolInfo.value0)
//   pool.balance = pairContract.balanceOf(FARMING_ADDRESS)

//   pool.lastRewardBlock = poolInfo.value2
//   pool.accMoneyPerShare = poolInfo.value3

//   const poolDays = event.block.timestamp.minus(pool.updatedAt).divDecimal(BigDecimal.fromString('86400'))
//   pool.hvlpAge = pool.hvlpAge.plus(poolDays.times(pool.hvlpBalance))

//   pool.hvlpDeposited = pool.hvlpDeposited.plus(amount)
//   pool.hvlpBalance = pool.hvlpBalance.plus(amount)

//   pool.updatedAt = event.block.timestamp

//   const userInfo = farmingContract.userInfo(event.params.pid, event.params.user)

//   const user = getUser(event.params.pid, event.params.user, event.block)

//   // If not currently in pool and depositing HVLP
//   if (!user.pool && event.params.amount.gt(BIG_INT_ZERO)) {
//     user.pool = pool.id
//     pool.userCount = pool.userCount.plus(BIG_INT_ONE)
//   }

//   // Calculate MONEY being paid out
//   if (event.block.number.gt(FARMING_START_BLOCK) && user.amount.gt(BIG_INT_ZERO)) {
//     const pending = user.amount
//       .toBigDecimal()
//       .times(pool.accMoneyPerShare.toBigDecimal())
//       .div(BIG_DECIMAL_1E12)
//       .minus(user.rewardDebt.toBigDecimal())
//       .div(BIG_DECIMAL_1E18)
//     // log.info('Deposit: User amount is more than zero, we should harvest {} money', [pending.toString()])
//     if (pending.gt(BIG_DECIMAL_ZERO)) {
//       // log.info('Harvesting {} MONEY', [pending.toString()])
//       const moneyHarvestedUSD = pending.times(getMoneyPrice(event.block))
//       user.moneyHarvested = user.moneyHarvested.plus(pending)
//       user.moneyHarvestedUSD = user.moneyHarvestedUSD.plus(moneyHarvestedUSD)
//       pool.moneyHarvested = pool.moneyHarvested.plus(pending)
//       pool.moneyHarvestedUSD = pool.moneyHarvestedUSD.plus(moneyHarvestedUSD)
//       poolHistory.moneyHarvested = pool.moneyHarvested
//       poolHistory.moneyHarvestedUSD = pool.moneyHarvestedUSD
//     }
//   }

//   user.amount = userInfo.value0
//   user.rewardDebt = userInfo.value1

//   if (event.params.amount.gt(BIG_INT_ZERO)) {
//     const reservesResult = pairContract.try_getReserves()
//     if (!reservesResult.reverted) {
//       const totalSupply = pairContract.totalSupply()

//       const share = amount.div(totalSupply.toBigDecimal())

//       const token0Amount = reservesResult.value.value0.toBigDecimal().times(share)

//       const token1Amount = reservesResult.value.value1.toBigDecimal().times(share)

//       const token0PriceUSD = getUSDRate(pairContract.token0(), event.block)

//       const token1PriceUSD = getUSDRate(pairContract.token1(), event.block)

//       const token0USD = token0Amount.times(token0PriceUSD)

//       const token1USD = token1Amount.times(token1PriceUSD)

//       const entryUSD = token0USD.plus(token1USD)

//       // log.info(
//       //   'Token {} priceUSD: {} reserve: {} amount: {} / Token {} priceUSD: {} reserve: {} amount: {} - hvlp amount: {} total supply: {} share: {}',
//       //   [
//       //     token0.symbol(),
//       //     token0PriceUSD.toString(),
//       //     reservesResult.value.value0.toString(),
//       //     token0Amount.toString(),
//       //     token1.symbol(),
//       //     token1PriceUSD.toString(),
//       //     reservesResult.value.value1.toString(),
//       //     token1Amount.toString(),
//       //     amount.toString(),
//       //     totalSupply.toString(),
//       //     share.toString(),
//       //   ]
//       // )

//       // log.info('User {} has deposited {} HVLP tokens {} {} (${}) and {} {} (${}) at a combined value of ${}', [
//       //   user.address.toHex(),
//       //   amount.toString(),
//       //   token0Amount.toString(),
//       //   token0.symbol(),
//       //   token0USD.toString(),
//       //   token1Amount.toString(),
//       //   token1.symbol(),
//       //   token1USD.toString(),
//       //   entryUSD.toString(),
//       // ])

//       user.entryUSD = user.entryUSD.plus(entryUSD)

//       pool.entryUSD = pool.entryUSD.plus(entryUSD)

//       poolHistory.entryUSD = pool.entryUSD
//     }
//   }

//   user.save()
//   pool.save()

//   const farming = getFarming(event.block)

//   const farmingDays = event.block.timestamp.minus(farming.updatedAt).divDecimal(BigDecimal.fromString('86400'))
//   farming.hvlpAge = farming.hvlpAge.plus(farmingDays.times(farming.hvlpBalance))

//   farming.hvlpDeposited = farming.hvlpDeposited.plus(amount)
//   farming.hvlpBalance = farming.hvlpBalance.plus(amount)

//   farming.updatedAt = event.block.timestamp
//   farming.save()

//   const history = getHistory(FARMING_ADDRESS.toHex(), event.block)
//   history.hvlpAge = farming.hvlpAge
//   history.hvlpBalance = farming.hvlpBalance
//   history.hvlpDeposited = history.hvlpDeposited.plus(amount)
//   history.save()

//   poolHistory.hvlpAge = pool.hvlpAge
//   poolHistory.hvlpBalance = pool.balance.divDecimal(BIG_DECIMAL_1E18)
//   poolHistory.hvlpDeposited = poolHistory.hvlpDeposited.plus(amount)
//   poolHistory.userCount = pool.userCount
//   poolHistory.save()
// }

// export function withdraw(event: Withdraw): void {
//   // if (event.params.amount == BIG_INT_ZERO && User.load(event.params.user.toHex()) !== null) {
//   //   log.info('Withdrawal zero transaction, input {} hash {}', [
//   //     event.transaction.input.toHex(),
//   //     event.transaction.hash.toHex(),
//   //   ])
//   // }

//   const amount = event.params.amount.divDecimal(BIG_DECIMAL_1E18)

//   // log.info('{} has withdrawn {} hvlp tokens from pool #{}', [
//   //   event.params.user.toHex(),
//   //   amount.toString(),
//   //   event.params.pid.toString(),
//   // ])

//   const farmingContract = FarmingContract.bind(FARMING_ADDRESS)

//   const poolInfo = farmingContract.poolInfo(event.params.pid)

//   const pool = getPool(event.params.pid, event.block)

//   const poolHistory = getPoolHistory(pool, event.block)

//   const pairContract = PairContract.bind(poolInfo.value0)
//   pool.balance = pairContract.balanceOf(FARMING_ADDRESS)
//   pool.lastRewardBlock = poolInfo.value2
//   pool.accMoneyPerShare = poolInfo.value3

//   const poolDays = event.block.timestamp.minus(pool.updatedAt).divDecimal(BigDecimal.fromString('86400'))
//   const poolAge = pool.hvlpAge.plus(poolDays.times(pool.hvlpBalance))
//   const poolAgeRemoved = poolAge.div(pool.hvlpBalance).times(amount)
//   pool.hvlpAge = poolAge.minus(poolAgeRemoved)
//   pool.hvlpAgeRemoved = pool.hvlpAgeRemoved.plus(poolAgeRemoved)
//   pool.hvlpWithdrawn = pool.hvlpWithdrawn.plus(amount)
//   pool.hvlpBalance = pool.hvlpBalance.minus(amount)
//   pool.updatedAt = event.block.timestamp

//   const user = getUser(event.params.pid, event.params.user, event.block)

//   if (event.block.number.gt(FARMING_START_BLOCK) && user.amount.gt(BIG_INT_ZERO)) {
//     const pending = user.amount
//       .toBigDecimal()
//       .times(pool.accMoneyPerShare.toBigDecimal())
//       .div(BIG_DECIMAL_1E12)
//       .minus(user.rewardDebt.toBigDecimal())
//       .div(BIG_DECIMAL_1E18)
//     // log.info('Withdraw: User amount is more than zero, we should harvest {} money - block: {}', [
//     //   pending.toString(),
//     //   event.block.number.toString(),
//     // ])
//     // log.info('MONEY PRICE {}', [getMoneyPrice(event.block).toString()])
//     if (pending.gt(BIG_DECIMAL_ZERO)) {
//       // log.info('Harvesting {} MONEY (CURRENT MONEY PRICE {})', [
//       //   pending.toString(),
//       //   getMoneyPrice(event.block).toString(),
//       // ])
//       const moneyHarvestedUSD = pending.times(getMoneyPrice(event.block))
//       user.moneyHarvested = user.moneyHarvested.plus(pending)
//       user.moneyHarvestedUSD = user.moneyHarvestedUSD.plus(moneyHarvestedUSD)
//       pool.moneyHarvested = pool.moneyHarvested.plus(pending)
//       pool.moneyHarvestedUSD = pool.moneyHarvestedUSD.plus(moneyHarvestedUSD)
//       poolHistory.moneyHarvested = pool.moneyHarvested
//       poolHistory.moneyHarvestedUSD = pool.moneyHarvestedUSD
//     }
//   }

//   const userInfo = farmingContract.userInfo(event.params.pid, event.params.user)

//   user.amount = userInfo.value0
//   user.rewardDebt = userInfo.value1

//   if (event.params.amount.gt(BIG_INT_ZERO)) {
//     const reservesResult = pairContract.try_getReserves()

//     if (!reservesResult.reverted) {
//       const totalSupply = pairContract.totalSupply()

//       const share = amount.div(totalSupply.toBigDecimal())

//       const token0Amount = reservesResult.value.value0.toBigDecimal().times(share)

//       const token1Amount = reservesResult.value.value1.toBigDecimal().times(share)

//       const token0PriceUSD = getUSDRate(pairContract.token0(), event.block)

//       const token1PriceUSD = getUSDRate(pairContract.token1(), event.block)

//       const token0USD = token0Amount.times(token0PriceUSD)

//       const token1USD = token1Amount.times(token1PriceUSD)

//       const exitUSD = token0USD.plus(token1USD)

//       pool.exitUSD = pool.exitUSD.plus(exitUSD)

//       poolHistory.exitUSD = pool.exitUSD

//       // log.info('User {} has withdrwn {} HVLP tokens {} {} (${}) and {} {} (${}) at a combined value of ${}', [
//       //   user.address.toHex(),
//       //   amount.toString(),
//       //   token0Amount.toString(),
//       //   token0USD.toString(),
//       //   pairContract.token0().toHex(),
//       //   token1Amount.toString(),
//       //   token1USD.toString(),
//       //   pairContract.token1().toHex(),
//       //   exitUSD.toString(),
//       // ])

//       user.exitUSD = user.exitUSD.plus(exitUSD)
//     } else {
//       log.info("Withdraw couldn't get reserves for pair {}", [poolInfo.value0.toHex()])
//     }
//   }

//   // If HVLP amount equals zero, remove from pool and reduce userCount
//   if (user.amount.equals(BIG_INT_ZERO)) {
//     user.pool = null
//     pool.userCount = pool.userCount.minus(BIG_INT_ONE)
//   }

//   user.save()
//   pool.save()

//   const farming = getFarming(event.block)

//   const days = event.block.timestamp.minus(farming.updatedAt).divDecimal(BigDecimal.fromString('86400'))
//   const hvlpAge = farming.hvlpAge.plus(days.times(farming.hvlpBalance))
//   const hvlpAgeRemoved = hvlpAge.div(farming.hvlpBalance).times(amount)
//   farming.hvlpAge = hvlpAge.minus(hvlpAgeRemoved)
//   farming.hvlpAgeRemoved = farming.hvlpAgeRemoved.plus(hvlpAgeRemoved)

//   farming.hvlpWithdrawn = farming.hvlpWithdrawn.plus(amount)
//   farming.hvlpBalance = farming.hvlpBalance.minus(amount)
//   farming.updatedAt = event.block.timestamp
//   farming.save()

//   const history = getHistory(FARMING_ADDRESS.toHex(), event.block)
//   history.hvlpAge = farming.hvlpAge
//   history.hvlpAgeRemoved = history.hvlpAgeRemoved.plus(hvlpAgeRemoved)
//   history.hvlpBalance = farming.hvlpBalance
//   history.hvlpWithdrawn = history.hvlpWithdrawn.plus(amount)
//   history.save()

//   poolHistory.hvlpAge = pool.hvlpAge
//   poolHistory.hvlpAgeRemoved = poolHistory.hvlpAgeRemoved.plus(hvlpAgeRemoved)
//   poolHistory.hvlpBalance = pool.balance.divDecimal(BIG_DECIMAL_1E18)
//   poolHistory.hvlpWithdrawn = poolHistory.hvlpWithdrawn.plus(amount)
//   poolHistory.userCount = pool.userCount
//   poolHistory.save()
// }
