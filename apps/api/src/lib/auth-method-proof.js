import { hashToken } from './security.js';

export function authMethodProof(kind,row) {
 return {kind,id:row.id,fingerprint:hashToken(JSON.stringify(kind==='google'
  ? [row.id,row.user_id,row.issuer,row.subject]
  : [row.id,row.user_id,row.credential_id,Buffer.from(row.public_key).toString('base64url')]))};
}
export async function authMethodIsCurrent(t,userId,proof) {
 if(!proof||!['google','passkey'].includes(proof.kind)||typeof proof.id!=='string')return false;
 const row=await t.one(proof.kind==='google'
  ? 'SELECT * FROM account_google_identities WHERE id=$1 AND user_id=$2 FOR SHARE'
  : 'SELECT * FROM account_passkeys WHERE id=$1 AND user_id=$2 FOR SHARE',[proof.id,userId]);
 return Boolean(row&&authMethodProof(proof.kind,row).fingerprint===proof.fingerprint);
}
