import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { createSoftwarePasskey } from "./helpers/software-passkey.mjs";

const rpID = "auth.obligon.test";
const origin = `https://${rpID}`;
const challenge = () => randomBytes(32).toString("base64url");

async function registered() {
  const userId = randomUUID();
  const key = createSoftwarePasskey({ rpID, origin, userId });
  const expectedChallenge = challenge();
  const result = await verifyRegistrationResponse({
    response: key.register(expectedChallenge), expectedChallenge, expectedOrigin: origin,
    expectedRPID: rpID, requireUserVerification: true, supportedAlgorithmIDs: [-7]
  });
  assert.equal(result.verified, true);
  assert.equal(result.registrationInfo.credential.id, key.id);
  assert.equal(result.registrationInfo.credential.counter, 0);
  return { key, userId, credential: result.registrationInfo.credential };
}

test("software fixture registers a genuine ES256 public key and signs assertions accepted by SimpleWebAuthn", async () => {
  const { key, userId, credential } = await registered();
  const expectedChallenge = challenge();
  const response = key.authenticate(expectedChallenge);
  assert.equal(response.response.userHandle, Buffer.from(userId.replaceAll("-", ""), "hex").toString("base64url"));
  const result = await verifyAuthenticationResponse({ response, expectedChallenge, expectedOrigin: origin,
    expectedRPID: rpID, credential, requireUserVerification: true });
  assert.equal(result.verified, true);
  assert.equal(result.authenticationInfo.newCounter, 1);
  assert.equal(result.authenticationInfo.userVerified, true);
  const nextChallenge = challenge();
  const next = await verifyAuthenticationResponse({ response: key.authenticate(nextChallenge), expectedChallenge: nextChallenge,
    expectedOrigin: origin, expectedRPID: rpID, credential: { ...credential, counter: 1 }, requireUserVerification: true });
  assert.equal(next.verified, true);
  assert.equal(next.authenticationInfo.newCounter, 2);
});

test("fixture variations exercise wrong origins, RP IDs, challenges, missing verification and counter replay", async () => {
  const { key, credential } = await registered();
  for (const alter of [{ origin: "https://attacker.invalid" }, { userVerified: false }]) {
    const expectedChallenge = challenge();
    await assert.rejects(verifyAuthenticationResponse({ response: key.authenticate(expectedChallenge, alter), expectedChallenge,
      expectedOrigin: origin, expectedRPID: rpID, credential, requireUserVerification: true }));
  }
  const expectedChallenge = challenge(), response = key.authenticate(expectedChallenge, { counter: 1 });
  for (const changes of [{ expectedChallenge: challenge() }, { expectedRPID: "attacker.invalid" }, { credential: { ...credential, counter: 1 } }]) {
    await assert.rejects(verifyAuthenticationResponse({ response, expectedChallenge, expectedOrigin: origin,
      expectedRPID: rpID, credential, requireUserVerification: true, ...changes }));
  }
});

test("the verifier rejects a modified ES256 signature instead of trusting fixture JSON", async () => {
  const { key, credential } = await registered();
  const expectedChallenge = challenge(), response = key.authenticate(expectedChallenge);
  const signature = Buffer.from(response.response.signature, "base64url");
  signature[signature.length - 1] ^= 1;
  response.response.signature = signature.toString("base64url");
  const result = await verifyAuthenticationResponse({ response, expectedChallenge, expectedOrigin: origin,
    expectedRPID: rpID, credential, requireUserVerification: true });
  assert.equal(result.verified, false);
});

test("the fixture can sign an assertion with another UUID user handle for caller authorization tests", async () => {
  const { key } = await registered();
  const userId = randomUUID();
  const response = key.authenticate(challenge(), { userId });
  assert.equal(response.response.userHandle, Buffer.from(userId.replaceAll("-", ""), "hex").toString("base64url"));
});
