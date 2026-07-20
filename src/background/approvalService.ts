// The promise-based approval queue.
//
// This is the essence of OneKey's `serviceDApp.openConnectionModal`: a provider
// method calls `approvalService.request(...)` and `await`s a Promise that only
// settles when the user taps Approve / Reject in the modal. The UI subscribes to
// the queue and renders the head entry.

export type IApprovalType = 'connect' | 'sign' | 'tx';

export interface IApprovalRequest {
  id: number;
  type: IApprovalType;
  origin: string;
  method: string;
  payload?: unknown;
}

interface IQueueEntry {
  req: IApprovalRequest;
  resolve: () => void;
  reject: (e: unknown) => void;
}

let counter = 1;
let queue: IQueueEntry[] = [];
const listeners = new Set<() => void>();

// Cached snapshot for `useSyncExternalStore`: it compares snapshots by identity,
// so `getPending` must return the *same* array until the queue actually changes.
let snapshot: IApprovalRequest[] = [];

function notify(): void {
  snapshot = queue.map((e) => e.req);
  listeners.forEach((l) => l());
}

function userRejectedError(): Error & { code: number } {
  const err = new Error('User rejected the request') as Error & { code: number };
  err.code = 4001; // EIP-1193 userRejectedRequest
  return err;
}

export const approvalService = {
  // Called from the background provider; resolves on approve, rejects (4001) on reject.
  request(input: Omit<IApprovalRequest, 'id'>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const req: IApprovalRequest = { ...input, id: counter++ };
      queue.push({ req, resolve, reject });
      notify();
    });
  },

  approve(id: number): void {
    const idx = queue.findIndex((e) => e.req.id === id);
    if (idx === -1) return;
    const [entry] = queue.splice(idx, 1);
    entry.resolve();
    notify();
  },

  reject(id: number): void {
    const idx = queue.findIndex((e) => e.req.id === id);
    if (idx === -1) return;
    const [entry] = queue.splice(idx, 1);
    entry.reject(userRejectedError());
    notify();
  },

  // Read side for the UI.
  getPending(): IApprovalRequest[] {
    return snapshot;
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  // Test helper — clears the queue without settling.
  _reset(): void {
    queue = [];
    snapshot = [];
    counter = 1;
  },
};
