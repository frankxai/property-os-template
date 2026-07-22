import assert from "node:assert/strict";
import { createServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { createTokenVerifier, loadHttpPolicy } from "../src/auth.mjs";

const issuer = "https://identity.example.test";
const audience = "property-os-mcp";
const admittedTenant = "org-a";
const { publicKey, privateKey } = await generateKeyPair("RS256");
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = "property-os-test-key";
publicJwk.alg = "RS256";
publicJwk.use = "sig";

const jwksServer = createServer((request, response) => {
  if (request.url !== "/.well-known/jwks.json") {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify({ keys: [publicJwk] }));
});
await new Promise((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
const address = jwksServer.address();
if (!address || typeof address === "string") throw new Error("JWKS smoke server did not bind to a TCP port.");

function oidcPolicyEnv(overrides = {}) {
  return {
    PROPERTY_OS_MCP_AUTH_MODE: "oidc",
    PROPERTY_OS_MCP_PUBLIC_URL: "https://mcp.example.test",
    PROPERTY_OS_MCP_ALLOWED_HOSTS: "mcp.example.test",
    PROPERTY_OS_MCP_ALLOWED_ORIGINS: "https://portal.example.test",
    PROPERTY_OS_MCP_ALLOWED_TENANTS: admittedTenant,
    PROPERTY_OS_MCP_ALLOW_INSECURE_LOCAL: "true",
    PROPERTY_OS_MCP_OIDC_ISSUER: issuer,
    PROPERTY_OS_MCP_OIDC_AUDIENCE: audience,
    PROPERTY_OS_MCP_OIDC_JWKS_URL: `http://127.0.0.1:${address.port}/.well-known/jwks.json`,
    PROPERTY_OS_MCP_TENANT_CLAIM: "tenant_id",
    PROPERTY_OS_MCP_ROLE_CLAIM: "role",
    ...overrides
  };
}

async function token(claims = {}, protectedHeader = {}, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  let signer = new SignJWT({ tenant_id: admittedTenant, role: "owner", scope: "property:read property:draft", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid, ...protectedHeader })
    .setIssuer(claims.iss ?? issuer)
    .setAudience(claims.aud ?? audience);
  if (options.includeSubject !== false) signer = signer.setSubject("owner-123");
  if (options.includeIssuedAt !== false) signer = signer.setIssuedAt(claims.iat ?? now);
  if (options.includeExpiration !== false) signer = signer.setExpirationTime(claims.exp ?? now + 300);
  return signer.sign(privateKey);
}

try {
  assert.throws(
    () => loadHttpPolicy(oidcPolicyEnv({ PROPERTY_OS_MCP_ALLOWED_TENANTS: "" })),
    /ALLOWED_TENANTS is required/
  );
  assert.throws(
    () => loadHttpPolicy(oidcPolicyEnv({
      HOST: "0.0.0.0",
      PROPERTY_OS_MCP_ALLOW_INSECURE_LOCAL: "false",
      PROPERTY_OS_MCP_PUBLIC_URL: "http://mcp.example.test/mcp"
    })),
    /PUBLIC_URL must use HTTPS/
  );
  assert.throws(
    () => loadHttpPolicy(oidcPolicyEnv({
      HOST: "0.0.0.0",
      PROPERTY_OS_MCP_ALLOW_INSECURE_LOCAL: "false",
      PROPERTY_OS_MCP_OIDC_ISSUER: "http://identity.example.test"
    })),
    /OIDC_ISSUER must use HTTPS/
  );
  assert.throws(
    () => loadHttpPolicy(oidcPolicyEnv({
      HOST: "0.0.0.0",
      PROPERTY_OS_MCP_ALLOW_INSECURE_LOCAL: "false",
      PROPERTY_OS_MCP_OIDC_JWKS_URL: "https://169.254.169.254/.well-known/jwks.json"
    })),
    /OIDC_JWKS_URL cannot target a private or reserved host/
  );

  const policy = loadHttpPolicy(oidcPolicyEnv());
  const verifier = createTokenVerifier(policy);
  const verified = await verifier.verifyAccessToken(await token());
  assert.equal(verified.extra.tenantId, admittedTenant);
  assert.equal(verified.extra.actorRole, "owner");
  assert.ok(verified.scopes.includes("property:read"));

  await assert.rejects(
    async () => verifier.verifyAccessToken(await token({ tenant_id: "org-b" })),
    /not admitted/
  );
  await assert.rejects(
    async () => verifier.verifyAccessToken(await token({ tenant_id: undefined })),
    /missing the tenant claim/
  );
  await assert.rejects(
    async () => verifier.verifyAccessToken(await token({ aud: "wrong-audience" })),
    /aud|claim/i
  );
  await assert.rejects(
    async () => verifier.verifyAccessToken(await token({ iss: "https://attacker.example.test" })),
    /iss|claim/i
  );
  await assert.rejects(
    async () => verifier.verifyAccessToken(await token({ exp: Math.floor(Date.now() / 1000) - 30 })),
    /exp|expired/i
  );
  await assert.rejects(
    async () => verifier.verifyAccessToken(await token({}, {}, { includeExpiration: false })),
    /exp|required/i
  );
  await assert.rejects(
    async () => verifier.verifyAccessToken(await token({}, {}, { includeIssuedAt: false })),
    /iat|required/i
  );
  await assert.rejects(
    async () => verifier.verifyAccessToken(await token({ exp: Math.floor(Date.now() / 1000) + 3600 })),
    /lifetime|token/i
  );
  await assert.rejects(
    async () => verifier.verifyAccessToken(await token({}, {}, { includeSubject: false })),
    /sub|required/i
  );

  console.log("Property OS OIDC JWKS and tenant-admission smoke passed.");
} finally {
  await new Promise((resolve) => jwksServer.close(resolve));
}
