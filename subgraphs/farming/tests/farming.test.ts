import { Address, ethereum } from '@graphprotocol/graph-ts'
import { newMockEvent } from 'matchstick-as'
import { NewPool } from '../generated/FarmFactory/FarmFactory'
import { clearStore, test, assert } from "matchstick-as/assembly/index";
import { Farm } from '../generated/templates/Farm/Farm';

export function createNewPoolEvent(
  poolAddress: string,
  lpToken: string,
  allocPoint: BigInt,
  depositFee: BigInt
): NewPool {
  const newPoolEvent = newMockEvent(new NewPool()) as NewPool;
  newPoolEvent.parameters = []


  let poolAddressParam = new ethereum.EventParam(name: "farm", ethereum.Value.fromAddress(Address.fromString(poolAddress)))
  let lpTokenParam = new ethereum.EventParam(name: "lpToken", ethereum.Value.fromAddress(Address.fromString(lpToken)))
  let allocPointParam = new ethereum.EventParam(name: "allocPoint", allocPoint)
  let depositFeeParam = new ethereum.EventParam(name: "depositFeeBP", depositFee)

  newPoolEvent.parameters.push(poolAddressParam)
  newPoolEvent.parameters.push(lpTokenParam)
  newPoolEvent.parameters.push(allocPointParam)
  newPoolEvent.parameters.push(depositFeeParam)

  return newPoolEvent;
}

export function handleNewPool(event: NewPool): void {
  let farm = new Farm(event.params.farm.toHex())
  farm.lpToken = event.params.lpToken
  farm.allocPoint = event.params.allocPoint
  farm.depositFeeBP = event.params.depositFeeBP
  farm.save()
}

export function handleNewPools(events: NewPool[]): void {
  events.forEach(event => {
    handleNewPool(event);
  });
}

test("Can call mappings with custom events", () => {
  // Initialise
  let farm = new Farm("0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7");
  farm.save();

  // Call mappings
  let newPoolEvent = createNewPoolEvent(
    "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      BigInt("10"),
      BigInt("100"),
  );

  let anotherPoolEvent = createNewPoolEvent(
    "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    BigInt("10"),
    BigInt("100"),
  );

  handleNewPools([newPoolEvent, anotherPoolEvent]);

  assert.fieldEquals(
      "farm",
      "farmId0",
      "id",
      "farmId0",
  );
  assert.fieldEquals("farm", "12345", "id", "12345");
  assert.fieldEquals("farm", "3546", "id", "3546");
  clearStore();
});
