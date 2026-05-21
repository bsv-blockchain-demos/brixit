/**
 * Shared `ProtoWallet('anyone')` for verifying signatures made with
 * `counterparty: 'anyone'`. Anchored at the well-known anyone key so it
 * derives the same pubkey the signer signed against.
 */
import { ProtoWallet } from '@bsv/sdk';

export const anyoneWallet = new ProtoWallet('anyone');
