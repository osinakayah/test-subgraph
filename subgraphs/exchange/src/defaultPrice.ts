import {
    ADDRESS_ZERO,
    BIG_DECIMAL_1E18,
    BIG_DECIMAL_ONE,
    BIG_DECIMAL_ZERO, DAI, DAI_WETH_PAIR,
    FACTORY_ADDRESS, USDC, USDC_WETH_PAIR, USDT, USDT_WETH_PAIR,
    WETH_ADDRESS,
} from 'const'
import { Address, BigDecimal, log } from '@graphprotocol/graph-ts'
import {Factory as FactoryContract} from "../generated/Factory/Factory";
import {Core as PairContract} from "../generated/Factory/Core";
import {getToken} from "./enitites";
import {Pair} from "../generated/schema";

export function getEthRate(token: Address,): BigDecimal {

    let eth = BIG_DECIMAL_ONE

    if (token != WETH_ADDRESS) {
        const factory = FactoryContract.bind(FACTORY_ADDRESS)

        const address = factory.getPair(token, WETH_ADDRESS)

        if (address == ADDRESS_ZERO) {
            log.info('Adress ZERO...', [])
            return BIG_DECIMAL_ZERO
        }

        const pair = PairContract.bind(address)

        const tokenObj =  getToken(token)

        const reserves = pair.getReserves()


        const divisor = BigDecimal.fromString('1e'+tokenObj.decimals.toString())
        eth =
            pair.token0() == WETH_ADDRESS
                ? reserves.value0.toBigDecimal().times(BIG_DECIMAL_1E18).div(reserves.value1.toBigDecimal().times(divisor))
                : reserves.value1.toBigDecimal().times(BIG_DECIMAL_1E18).div(reserves.value0.toBigDecimal().times(divisor))


        return eth.div(BIG_DECIMAL_1E18)
    }

    return eth
}
export function defaultValues(pairAddress: string, stableCoinAddress: string): void {
    const pair = Pair.load(pairAddress)
    if (pair !== null) {
        const isTokenFirst = pair.token0 == stableCoinAddress

        const pairEthReserve = isTokenFirst ? pair.reserve1 : pair.reserve0
        const pairStableCoinReserve = isTokenFirst ? pair.reserve0 : pair.reserve1

        const stableCoinDerivedETH = pairEthReserve.div(pairStableCoinReserve)
        pair.reserveETH = pairEthReserve.times(BigDecimal.fromString('2'))
        pair.save()

        const token0 = getToken(Address.fromString(pair.token0))
        const token1 = getToken(Address.fromString(pair.token1))

        if (isTokenFirst) {
            token0.derivedETH = stableCoinDerivedETH
            token1.derivedETH = BIG_DECIMAL_ONE
        } else {
            token1.derivedETH = stableCoinDerivedETH
            token0.derivedETH = BIG_DECIMAL_ONE
        }
        token0.save()
        token1.save()
    }


}
export function setReserveETH(): void{
    defaultValues(DAI_WETH_PAIR, DAI)
    defaultValues(USDC_WETH_PAIR, USDC)
    defaultValues(USDT_WETH_PAIR, USDT)
}
