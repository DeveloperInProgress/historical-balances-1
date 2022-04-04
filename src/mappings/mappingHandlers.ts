import { SubstrateEvent, SubstrateBlock } from "@subql/types";
import { AccountInfo, EventRecord } from "@polkadot/types/interfaces/system";
import { AccountSnapshot } from "../types";


class AccountInfoAtBlock {
  accountId: string;
  balance: bigint;
  snapshotAtBlock: bigint;
  timestamp: Date;
}
export async function handleBlock(block: SubstrateBlock): Promise<void> {
  let blockNumber = block.block.header.number.toBigInt();
  //const { timestamp: createdAt, block: rawBlock } = block;
  let events = block.events;
  let accounts4snapshot: string[] = [];
  for (let i = 0; i < events.length; i++) {
    let event = events[i];
    const {
      event: { method, section, index },
    } = event;

    let accounts: string[] = [];
    if (section === "balances") {
      const eventType = `${section}/${method}`;
      logger.info(
        `
        Block: ${blockNumber}, Event ${eventType} :
        -------------
          ${JSON.stringify(event.toJSON(), null, 1)}  
        =============
        `
      );

      switch (method) {
        case "Endowed":
          accounts = await handleEndowed(event);
          break;
        case "Transfer":
          accounts = await handleTransfer(event);
          break;
        case "BalanceSet":
          accounts = await handleBalanceSet(event);
          break;
        case "Deposit":
          accounts = await handleDeposit(event);
          break;
        case "Deposited":
          accounts = await handleReservRepatriated(event);
          break;
        case "Withdraw":
          accounts = await handleWithdraw(event);
          break;
        default:
          break;
      }
    }
    if (section === "staking") {
      const eventType = `${section}/${method}`;
      logger.info(
        `
        Block: ${blockNumber}, Event ${eventType} :
        -------------
          ${JSON.stringify(event.toJSON(), null, 1)}  
        =============
        `
      )
      switch (method) {
        case "Rewarded":
          accounts = await handleRewarded(event);
          break;
      }
    }
    if (section === "crowdloan" && method === "Contributed") {
      const eventType = `${section}/${method}`;
      logger.info(
        `
        Block: ${blockNumber}, Event ${eventType} :
        -------------
          ${JSON.stringify(event.toJSON(), null, 1)}  
        =============
        `
      )
        accounts = await handleContributed(event);
    }
    for (const a of accounts) {
      if (accounts4snapshot.length > 0 && accounts4snapshot.indexOf(a) > -1) {
        continue;
      }
      accounts4snapshot.push(a);
    }
  }

  if (accounts4snapshot && accounts4snapshot.length > 0) {
    await takeAccountSnapshot(blockNumber, accounts4snapshot, block.timestamp);
  }
}
async function takeAccountSnapshot(
  blockNumber: bigint,
  accounts4snapshot: string[],
  timestamp: Date
) {
  for (const accountId of accounts4snapshot) {
    let accountInfo: AccountInfoAtBlock = await getAccountInfoAtBlockNumber(
      accountId,
      blockNumber,
      timestamp
    );
    let id = `${blockNumber.toString()}-${accountId}`;
    let snapshotRecords = await AccountSnapshot.get(id);

    if (!snapshotRecords) {
      let newSnapshot: AccountSnapshot = AccountSnapshot.create({
        id: id,
        accountId: accountId,
        snapshotAtBlock: accountInfo.snapshotAtBlock,
        balance: accountInfo.balance,
        timestamp: timestamp
      });
      await newSnapshot.save();
    }
  }
}
async function getAccountInfoAtBlockNumber(
  accountId: string,
  blockNumber: bigint,
  timestamp: Date
): Promise<AccountInfoAtBlock> {
  logger.info(`getAccountInfo at ${blockNumber} by addres:${accountId}`);
  const balance = api.query.system.account
    ? (await api.query.system.account(accountId) as any).data.free
    : api.query.balances.account
    ? (await api.query.balances.account(accountId) as any).free
    : await api.query.balances.freeBalance(accountId);
  let accountInfo: AccountInfoAtBlock;
    accountInfo = {
      accountId: accountId,
      balance: BigInt(balance.toString()),
      snapshotAtBlock: blockNumber,
      timestamp: timestamp,
    };

  logger.info(
    `getAccountInfo at ${blockNumber} : ${accountInfo.accountId}--${accountInfo.balance}`
  );
  return accountInfo;
}

export async function handleEvent(event: SubstrateEvent): Promise<void> { }

async function handleEndowed(
  substrateEvent: EventRecord
): Promise<string[]> {
  const { event } = substrateEvent;
  const [accountId, balanceChange] = event.data.toJSON() as [string, bigint];

  logger.info(`New Endowed happened!: ${JSON.stringify(event)}`);

  return [accountId];
}

export const handleTransfer = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const { event } = substrateEvent;
  const [from, to, balanceChange] = event.data.toJSON() as [
    string,
    string,
    bigint
  ];
  logger.info(`New Transfer happened!: ${JSON.stringify(event)}`);

  return [from, to];
};

//“AccountId” ‘s free balance =”Balance1”, reserve balance = “Balance2”
export const handleBalanceSet = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const { event } = substrateEvent;
  const [accountToSet, balance1, balance2] = event.data.toJSON() as [
    string,
    bigint,
    bigint
  ];

  logger.info(`BalanceSet happened!: ${JSON.stringify(event)}`);

  return [accountToSet];
};

//“AccountId” ’s free balance + “Balance”
export const handleDeposit = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const { event } = substrateEvent;
  const [accountToSet, balance] = event.data.toJSON() as [string, bigint];

  logger.info(`Deposit happened!: ${JSON.stringify(event)}`);

  return [accountToSet];
};

//“AccountId” ‘s free balance - “Balance”,“AccountId” ‘s reserve balance + “Balance”
export const handleReserved = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const { event } = substrateEvent;
  const [accountToSet, balance] = event.data.toJSON() as [string, bigint];

  logger.info(`Reserved happened!: ${JSON.stringify(event)}`);

  return [accountToSet];
};

//“AccountId” ‘s free balance + “Balance”, “AccountId” ‘s reserve balance - “Balance”
export const handleUnreserved = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const { event } = substrateEvent;
  const [accountToSet, balance] = event.data.toJSON() as [string, bigint];

  logger.info(`Unreserved happened!: ${JSON.stringify(event)}`);

  return [accountToSet];
};

//“AccountId” ‘s free balance - “Balance”
export const handleWithdraw = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const { event } = substrateEvent;
  const [accountToSet, balance] = event.data.toJSON() as [string, bigint];

  logger.info(`Withdraw happened!: ${JSON.stringify(event)}`);

  return [accountToSet];
};

//“AccountId” ‘s total balance - “Balance”
//(hard to determine if the slash happens on free/reserve)
//If it is called through internal method “slash”, then it will prefer free balance first but potential slash reserve if free is not sufficient.
//If it is called through internal method “slash_reserved”, then it will slash reserve only.
export const handleSlash = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const { event } = substrateEvent;
  const [accountToSet, balance] = event.data.toJSON() as [string, bigint];

  logger.info(`Slash happened!: ${JSON.stringify(event)}`);

  return [accountToSet];
};

/* -ReserveRepatriated(AccountId, AccountId, Balance, Status) 
    AccountId: sender  
    AccountId: receiver
    Balance: amount of sender's reserve being transfered
    Status: Indicating the amount is added to receiver's reserve part or free part of balance.
    “AccountId1” ‘s reserve balance - “Balance”
    “AccountId2” ‘s “Status” balance + “Balance” (”Status” indicator of free/reserve part) */

export const handleReservRepatriated = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const { event } = substrateEvent;
  const [sender, receiver, balance, status] = event.data.toJSON() as [
    string,
    string,
    bigint,
    string
  ];

  logger.info(`Repatraiated happened!: ${JSON.stringify(event)}`);

  return [sender, receiver];
};


export const handleRewarded = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const {event} = substrateEvent;
  const [ stash, balance ] = event.data.toJSON() as [
    string,
    bigint
  ]

  logger.info(`Rewarded happened!: ${JSON.stringify(event)}`)

  return [stash];
}

export const handleContributed = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const {event} = substrateEvent;
  const [ who, fund_index, amount ] = event.data.toJSON() as [
    string,
    bigint,
    bigint
  ]

  logger.info(`Contributed happened!: ${JSON.stringify(event)}`)

  return [who];
}

export const handleBonded = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const {event} = substrateEvent;
  const [ stash, amount ] = event.data.toJSON() as [
    string,
    bigint,
  ]

  logger.info(`Bonded happened!: ${JSON.stringify(event)}`)

  return [stash];
}

export const handleUnbonded = async (
  substrateEvent: EventRecord
): Promise<string[]> => {
  const {event} = substrateEvent;
  const [ stash, amount ] = event.data.toJSON() as [
    string,
    bigint,
  ]

  logger.info(`Unbonded happened!: ${JSON.stringify(event)}`)

  return [stash];
}
