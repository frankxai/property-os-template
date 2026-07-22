import { timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const DEFAULT_SCOPES = ["property:read", "property:draft", "property:approve", "property:apply:internal"];

function splitList(value) {
  return typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function sameSecret(actual, expected) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isLoopback(host) {
  return new Set(["127.0.0.1", "localhost", "::1"]).has(host);
}

export function loadHttpPolicy(env = process.env, overrides = {}) {
  const host = overrides.host ?? env.HOST ?? "127.0.0.1";
  const publicUrl = overrides.publicUrl ?? env.PROPERTY_OS_MCP_PUBLIC_URL ?? `http://${host}:${overrides.port ?? env.PORT ?? 8787}`;
  const inferredMode = env.PROPERTY_OS_MCP_OIDC_ISSUER ? "oidc" : "static";
  const authMode = overrides.authMode ?? env.PROPERTY_OS_MCP_AUTH_MODE ?? inferredMode;
  const insecureLocal = overrides.insecureLocal ?? env.PROPERTY_OS_MCP_ALLOW_INSECURE_LOCAL === "true";
  const staticToken = overrides.staticToken ?? env.PROPERTY_OS_MCP_AUTH_TOKEN ?? (insecureLocal && isLoopback(host) ? "property-os-local-smoke" : "");
  const railwayHost = env.RAILWAY_PUBLIC_DOMAIN ? [env.RAILWAY_PUBLIC_DOMAIN] : [];
  const publicHost = (() => {
    try { return [new URL(publicUrl).hostname]; } catch { return []; }
  })();
  const allowedHosts = [...new Set([...(overrides.allowedHosts ?? splitList(env.PROPERTY_OS_MCP_ALLOWED_HOSTS)), ...railwayHost, ...publicHost])];
  const allowedOrigins = [...new Set(overrides.allowedOrigins ?? splitList(env.PROPERTY_OS_MCP_ALLOWED_ORIGINS))];
  const allowedTenants = [...new Set(overrides.allowedTenants ?? splitList(env.PROPERTY_OS_MCP_ALLOWED_TENANTS))];
  const defaultTenantId = overrides.defaultTenantId ?? env.PROPERTY_OS_DEFAULT_TENANT_ID ?? "sample-org";
  const configuredStaticScopes = overrides.staticScopes ?? splitList(env.PROPERTY_OS_MCP_STATIC_SCOPES);

  if (!isLoopback(host) && allowedHosts.length === 0) {
    throw new Error("PROPERTY_OS_MCP_ALLOWED_HOSTS or PROPERTY_OS_MCP_PUBLIC_URL is required for a public bind.");
  }
  if (authMode === "static" && !staticToken) {
    throw new Error("PROPERTY_OS_MCP_AUTH_TOKEN is required for Streamable HTTP static-token mode.");
  }
  if (authMode === "oidc") {
    for (const key of ["PROPERTY_OS_MCP_OIDC_ISSUER", "PROPERTY_OS_MCP_OIDC_AUDIENCE", "PROPERTY_OS_MCP_OIDC_JWKS_URL"]) {
      if (!env[key] && !overrides[key]) throw new Error(`${key} is required for OIDC mode.`);
    }
  }
  if (insecureLocal && !isLoopback(host)) {
    throw new Error("Insecure local mode may bind only to a loopback host.");
  }

  return {
    host,
    publicUrl,
    authMode,
    staticToken,
    insecureLocal,
    allowedHosts,
    allowedOrigins,
    allowedTenants,
    defaultTenantId,
    actorId: overrides.actorId ?? env.PROPERTY_OS_MCP_ACTOR_ID ?? "property-os-service",
    actorRole: overrides.actorRole ?? env.PROPERTY_OS_MCP_ACTOR_ROLE ?? "operator",
    staticScopes: configuredStaticScopes.length ? configuredStaticScopes : DEFAULT_SCOPES,
    oidcIssuer: overrides.PROPERTY_OS_MCP_OIDC_ISSUER ?? env.PROPERTY_OS_MCP_OIDC_ISSUER,
    oidcAudience: overrides.PROPERTY_OS_MCP_OIDC_AUDIENCE ?? env.PROPERTY_OS_MCP_OIDC_AUDIENCE,
    oidcJwksUrl: overrides.PROPERTY_OS_MCP_OIDC_JWKS_URL ?? env.PROPERTY_OS_MCP_OIDC_JWKS_URL,
    tenantClaim: overrides.tenantClaim ?? env.PROPERTY_OS_MCP_TENANT_CLAIM ?? "tenant_id",
    roleClaim: overrides.roleClaim ?? env.PROPERTY_OS_MCP_ROLE_CLAIM ?? "role"
  };
}

function assertTenant(policy, tenantId) {
  if (!tenantId) throw new Error("Validated token is missing the tenant claim.");
  if (policy.allowedTenants.length && !policy.allowedTenants.includes(tenantId)) {
    throw new Error("Validated token tenant is not admitted by this deployment.");
  }
}

export function createTokenVerifier(policy) {
  if (policy.authMode === "static") {
    return {
      async verifyAccessToken(token) {
        if (!sameSecret(token, policy.staticToken)) throw new Error("Invalid access token.");
        assertTenant(policy, policy.defaultTenantId);
        return {
          token,
          clientId: `${policy.defaultTenantId}:${policy.actorId}`,
          scopes: policy.staticScopes,
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          resource: new URL(policy.publicUrl),
          extra: {
            tenantId: policy.defaultTenantId,
            actorId: policy.actorId,
            actorRole: policy.actorRole,
            authMode: "static"
          }
        };
      }
    };
  }

  const jwks = createRemoteJWKSet(new URL(policy.oidcJwksUrl));
  return {
    async verifyAccessToken(token) {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: policy.oidcIssuer,
        audience: policy.oidcAudience,
        algorithms: ["RS256", "ES256", "EdDSA"]
      });
      const tenantId = typeof payload[policy.tenantClaim] === "string" ? payload[policy.tenantClaim] : "";
      assertTenant(policy, tenantId);
      const scopeValue = payload.scope ?? payload.scp;
      const scopes = Array.isArray(scopeValue)
        ? scopeValue.filter((value) => typeof value === "string")
        : typeof scopeValue === "string" ? scopeValue.split(" ").filter(Boolean) : [];
      return {
        token,
        clientId: typeof payload.client_id === "string" ? payload.client_id : payload.sub ?? "unknown-client",
        scopes,
        expiresAt: payload.exp,
        resource: new URL(policy.publicUrl),
        extra: {
          tenantId,
          actorId: payload.sub ?? "unknown-actor",
          actorRole: typeof payload[policy.roleClaim] === "string" ? payload[policy.roleClaim] : "agent",
          authMode: "oidc"
        }
      };
    }
  };
}

export function validateOrigin(policy, origin) {
  if (!origin) return true;
  return policy.allowedOrigins.includes(origin);
}

export function protectedResourceMetadata(policy) {
  return {
    resource: policy.publicUrl,
    authorization_servers: policy.authMode === "oidc" ? [policy.oidcIssuer] : [],
    bearer_methods_supported: ["header"],
    scopes_supported: DEFAULT_SCOPES,
    resource_name: "Property OS MCP",
    policy_version: "property-os-authority.v2"
  };
}
