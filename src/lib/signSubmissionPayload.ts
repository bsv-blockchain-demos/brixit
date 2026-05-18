/**
 * Frontend signing for a single submission reading.
 *
 * Produces the four fields the backend needs to anchor on chain: the
 * canonical payload bytes, the user's signature over them, a fresh random
 * keyID, and the user's identity pubkey. Counterparty 'anyone' makes the
 * derived signing pubkey publicly recomputable so third parties can verify
 * authorship from (userIdentityKey, protocol, userKeyID).
 */
import { Random, Utils, type WalletClient, type WalletProtocol } from '@bsv/sdk';
import { canonicalJSON } from './canonicalJSON';

const SIGNING_PROTOCOL: WalletProtocol = [2, 'brixit submission'];
const COUNTERPARTY = 'anyone';

export interface SubmissionSignature {
  /** Exact bytes the user signed — backend feeds this verbatim into the PushDrop. */
  payloadJson: string;
  userSignature: string;
  userKeyID: string;
  userIdentityKey: string;
}

function randomKeyID(): string {
  return Utils.toBase64(Random(32));
}

export async function signSubmissionPayload(
  wallet: WalletClient,
  userIdentityKey: string,
  payload: Record<string, unknown>,
): Promise<SubmissionSignature> {
  const payloadJson = canonicalJSON(payload);
  const userKeyID = randomKeyID();

  const { signature } = await wallet.createSignature({
    data: Utils.toArray(payloadJson, 'utf8'),
    protocolID: SIGNING_PROTOCOL,
    keyID: userKeyID,
    counterparty: COUNTERPARTY,
  });

  return {
    payloadJson,
    userSignature: Utils.toHex(signature as number[]),
    userKeyID,
    userIdentityKey,
  };
}
