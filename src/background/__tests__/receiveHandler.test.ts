// Pure-logic tests for the platform-independent background layer:
// scope routing + provider dispatch + the promise-based approval flow.
// No React Native involved — this is the part OneKey keeps in kit-bg.

import { approvalService } from '../approvalService';
import { walletDebug } from '../ProviderApiEthereum';
import { receiveHandler } from '../receiveHandler';

const ORIGIN = 'https://dapp.example';
const ADDRESS = walletDebug.state.address;

beforeEach(() => {
  approvalService._reset();
  walletDebug.state.connected.clear();
  walletDebug.state.chainId = '0x1';
});

// Approve/reject the head of the queue on the next tick, so an awaiting
// provider call resolves the way a user tap would.
function settleNext(action: 'approve' | 'reject'): void {
  setTimeout(() => {
    const head = approvalService.getPending()[0];
    if (head) approvalService[action](head.id);
  }, 0);
}

describe('receiveHandler routing', () => {
  it('rejects an unknown scope with code 4200', async () => {
    await expect(
      receiveHandler({ scope: 'dogecoin', method: 'x', params: [], origin: ORIGIN }),
    ).rejects.toMatchObject({ code: 4200 });
  });

  it('answers eth_chainId without any approval', async () => {
    const result = await receiveHandler({
      scope: 'ethereum',
      method: 'eth_chainId',
      params: [],
      origin: ORIGIN,
    });
    expect(result).toBe('0x1');
    expect(approvalService.getPending()).toHaveLength(0);
  });

  it('returns [] from eth_accounts before connecting', async () => {
    const result = await receiveHandler({
      scope: 'ethereum',
      method: 'eth_accounts',
      params: [],
      origin: ORIGIN,
    });
    expect(result).toEqual([]);
  });
});

describe('approval flow', () => {
  it('eth_requestAccounts waits for approval, then returns the address', async () => {
    settleNext('approve');
    const result = await receiveHandler({
      scope: 'ethereum',
      method: 'eth_requestAccounts',
      params: [],
      origin: ORIGIN,
    });
    expect(result).toEqual([ADDRESS]);
    // origin is now connected -> eth_accounts reflects it
    const accounts = await receiveHandler({
      scope: 'ethereum',
      method: 'eth_accounts',
      params: [],
      origin: ORIGIN,
    });
    expect(accounts).toEqual([ADDRESS]);
  });

  it('rejecting connect surfaces a 4001 error', async () => {
    settleNext('reject');
    await expect(
      receiveHandler({
        scope: 'ethereum',
        method: 'eth_requestAccounts',
        params: [],
        origin: ORIGIN,
      }),
    ).rejects.toMatchObject({ code: 4001 });
  });

  it('personal_sign requires a prior connection (4100)', async () => {
    await expect(
      receiveHandler({
        scope: 'ethereum',
        method: 'personal_sign',
        params: ['0xdead', ADDRESS],
        origin: ORIGIN,
      }),
    ).rejects.toMatchObject({ code: 4100 });
  });

  it('personal_sign returns a mock signature once connected + approved', async () => {
    settleNext('approve');
    await receiveHandler({
      scope: 'ethereum',
      method: 'eth_requestAccounts',
      params: [],
      origin: ORIGIN,
    });
    settleNext('approve');
    const sig = await receiveHandler({
      scope: 'ethereum',
      method: 'personal_sign',
      params: ['0xdeadbeef', ADDRESS],
      origin: ORIGIN,
    });
    expect(sig).toBe(`0x${'ab'.repeat(65)}`);
  });

  it('eth_sendTransaction returns a mock tx hash once connected + approved', async () => {
    settleNext('approve');
    await receiveHandler({
      scope: 'ethereum',
      method: 'eth_requestAccounts',
      params: [],
      origin: ORIGIN,
    });
    settleNext('approve');
    const hash = await receiveHandler({
      scope: 'ethereum',
      method: 'eth_sendTransaction',
      params: [{ to: ADDRESS, value: '0x0' }],
      origin: ORIGIN,
    });
    expect(hash).toBe(`0x${'cd'.repeat(32)}`);
  });
});
