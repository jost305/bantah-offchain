import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

const KEYPAIR_STORAGE = 'challenge_signing_keypair_v1';

export function generateKeypair() {
  const kp = nacl.sign.keyPair();
  const publicKey = util.encodeBase64(kp.publicKey);
  const secretKey = util.encodeBase64(kp.secretKey);
  return { publicKey, secretKey };
}

export async function ensureKeypairRegistered(apiFetch: (path: string, init?: RequestInit) => Promise<any>) {
  let stored = localStorage.getItem(KEYPAIR_STORAGE);
  if (!stored) {
    const kp = generateKeypair();
    localStorage.setItem(KEYPAIR_STORAGE, JSON.stringify(kp));
    // send public key to server
    try {
      await apiFetch('/api/users/me/signing-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: kp.publicKey })
      });
    } catch (err) {
      console.error('Failed to register signing public key:', err);
    }
    return kp;
  }
  return JSON.parse(stored);
}

export function signVote(secretKeyBase64: string, message: string) {
  const secretKey = util.decodeBase64(secretKeyBase64);
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, secretKey);
  return util.encodeBase64(signature);
}
