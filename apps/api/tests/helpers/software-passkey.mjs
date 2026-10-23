import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";

const hash = (value) => createHash("sha256").update(value).digest();
const encode = (value) => Buffer.from(value).toString("base64url");
const userHandle = (userId) => {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) throw new TypeError("Test user ID must be a UUID");
  return encode(Buffer.from(userId.replaceAll("-", ""), "hex"));
};

// A software authenticator for isolated protocol tests. It does not exercise device biometrics.
export function createSoftwarePasskey({ rpID, origin, userId }) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const coseKey = isoCBOR.encode(new Map([
    [1, 2], [3, -7], [-1, 1],
    [-2, new Uint8Array(Buffer.from(jwk.x, "base64url"))],
    [-3, new Uint8Array(Buffer.from(jwk.y, "base64url"))]
  ]));
  const credentialId = randomBytes(32), id = encode(credentialId);
  userHandle(userId);
  let count = 0;

  const clientData = (type, challenge, selectedOrigin) => Buffer.from(JSON.stringify({ type, challenge, origin: selectedOrigin, crossOrigin: false }));
  const authenticatorData = (flags, counter) => {
    if (!Number.isInteger(counter) || counter < 0 || counter > 0xffff_ffff) throw new TypeError("Test counter must be an unsigned 32-bit integer");
    const data = Buffer.alloc(37);
    hash(rpID).copy(data);
    data[32] = flags;
    data.writeUInt32BE(counter, 33);
    return data;
  };
  const envelope = (response) => ({ id, rawId: id, type: "public-key", authenticatorAttachment: "platform", clientExtensionResults: {}, response });

  return {
    id,
    register(challenge) {
      const length = Buffer.alloc(2);
      length.writeUInt16BE(credentialId.length);
      const authData = Buffer.concat([authenticatorData(0x45, 0), Buffer.alloc(16), length, credentialId, Buffer.from(coseKey)]);
      const attestation = isoCBOR.encode(new Map([
        ["fmt", "none"], ["attStmt", new Map()], ["authData", new Uint8Array(authData)]
      ]));
      return envelope({ clientDataJSON: encode(clientData("webauthn.create", challenge, origin)), attestationObject: encode(attestation), transports: ["internal"] });
    },
    authenticate(challenge, { counter = count + 1, userVerified = true, origin: selectedOrigin = origin, userId: selectedUser = userId } = {}) {
      const data = clientData("webauthn.get", challenge, selectedOrigin);
      const authData = authenticatorData(userVerified ? 0x05 : 0x01, counter);
      const signature = sign("sha256", Buffer.concat([authData, hash(data)]), privateKey);
      count = counter;
      return envelope({ clientDataJSON: encode(data), authenticatorData: encode(authData), signature: encode(signature), userHandle: userHandle(selectedUser) });
    }
  };
}
