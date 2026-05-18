/**
 * Frontend signing for a single submission reading.
 *
 * Produces the four fields the backend needs to anchor the submission on chain:
 *   - payloadJson:     canonical JSON the user signed (must be passed through unchanged)
 *   - userSignature:   hex DER signature
 *   - userKeyID:       fresh random per-submission keyID
 *   - userIdentityKey: signer's identity pubkey, hex
 *
 * The wallet derives a one-off signing key from (userIdentityKey, protocol,
 * userKeyID, counterparty='anyone'). Using a per-submission keyID means each
 * signature is unlinkable from the others without the keyID, and counterparty
 * 'anyone' makes the derived public key publicly recomputable — any third
 * party with (userIdentityKey, protocol, userKeyID) can verify authorship.
 */
import { Random, Utils, type WalletClient, type WalletProtocol } from '@bsv/sdk';
import { canonicalJSON } from './canonicalJSON';

/** Protocol ID matches the backend's PushDrop protocol so verifiers know which key was used. */
const SIGNING_PROTOCOL: WalletProtocol = [2, 'brixit submission'];
const COUNTERPARTY = 'anyone';

export interface SubmissionSignature {
  /** Canonical JSON of `payload` — backend stores and feeds this verbatim into the PushDrop. */
  payloadJson: string;
  /** DER signature, hex-encoded. */
  userSignature: string;
  /** Random per-submission keyID the wallet used to derive the signing key. */
  userKeyID: string;
  /** Signer's identity pubkey, hex-encoded. */
  userIdentityKey: string;
}

/** 32 bytes of randomness, base64-encoded → 44-char keyID. */
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
