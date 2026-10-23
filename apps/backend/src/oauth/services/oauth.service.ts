import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { ConfigService } from "@/platform/config/config.service";
import { OAuthClient } from "@/oauth/entities/oauth-client.entity";
import { OAuthToken, type OAuthTokenKind } from "@/oauth/entities/oauth-token.entity";

interface AuthCode {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  expires: number;
}

interface LinkCode {
  code: string;
  expires: number;
  attemptsLeft: number;
}

const CODE_TTL_MS = 5 * 60_000;
const ACCESS_TTL_S = 3600;
const REFRESH_TTL_MS = 90 * 24 * 3600 * 1000;
const LINK_CODE_TTL_MS = 10 * 60_000;
const LINK_CODE_ATTEMPTS = 5;

export class LinkCodeError extends Error {}

/** OAuth 2.1 with PKCE (S256) and dynamic client registration, which is what Alexa+ and Tavus need to link a self-hosted MCP server. */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly codes = new Map<string, AuthCode>();
  private linkCode: LinkCode | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectModel(OAuthClient.name) private readonly clients: Model<OAuthClient>,
    @InjectModel(OAuthToken.name) private readonly tokens: Model<OAuthToken>,
  ) {}

  get issuer() {
    return this.config.publicUrl;
  }

  get required() {
    return this.config.get("MCP_AUTH") === "required";
  }

  metadata() {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/oauth/authorize`,
      token_endpoint: `${this.issuer}/oauth/token`,
      registration_endpoint: `${this.issuer}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp:tools"],
    };
  }

  protectedResource() {
    return { resource: `${this.issuer}/mcp`, authorization_servers: [this.issuer], scopes_supported: ["mcp:tools"], bearer_methods_supported: ["header"] };
  }

  async register(body: { client_name?: string; redirect_uris?: string[] }) {
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u) => typeof u === "string") : [];
    if (redirectUris.length === 0) throw new Error("invalid_redirect_uri: at least one redirect_uri is required");
    const client = await this.clients.create({ clientId: `kanso_${randomBytes(8).toString("hex")}`, clientName: body.client_name, redirectUris });
    this.logger.log(`Registered OAuth client ${client.clientId} (${client.clientName ?? "unnamed"})`);
    return {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    };
  }

  async clientName(clientId: string | undefined) {
    if (!clientId) return undefined;
    return (await this.clients.findOne({ clientId }).exec())?.clientName;
  }

  /** A fresh code for the owner to type on the consent page. Only the web app at home can ask for one. */
  newLinkCode() {
    this.linkCode = { code: String(randomInt(0, 1_000_000)).padStart(6, "0"), expires: Date.now() + LINK_CODE_TTL_MS, attemptsLeft: LINK_CODE_ATTEMPTS };
    return { code: this.linkCode.code, expiresAt: new Date(this.linkCode.expires).toISOString() };
  }

  async approve(q: { client_id?: string; redirect_uri?: string; code_challenge?: string; code_challenge_method?: string; scope?: string }, linkCode: string) {
    if (!q.client_id || !q.redirect_uri || !q.code_challenge) throw new Error("client_id, redirect_uri and code_challenge are required");
    if ((q.code_challenge_method ?? "S256") !== "S256") throw new Error("Only S256 is supported");
    const client = await this.clients.findOne({ clientId: q.client_id }).exec();
    if (!client) throw new Error("This app is not registered with Kanso. Start linking again from the app.");
    if (!client.redirectUris.includes(q.redirect_uri)) throw new Error("redirect_uri is not registered for this client");
    this.checkLinkCode(linkCode);
    this.linkCode = null;
    const code = randomBytes(24).toString("base64url");
    this.codes.set(code, { client_id: q.client_id, redirect_uri: q.redirect_uri, code_challenge: q.code_challenge, scope: q.scope ?? "mcp:tools", expires: Date.now() + CODE_TTL_MS });
    this.logger.log(`Approved OAuth client ${client.clientId} (${client.clientName ?? "unnamed"})`);
    return code;
  }

  async exchange(body: Record<string, string | undefined>) {
    if (body.grant_type === "refresh_token") {
      const stored = body.refresh_token ? await this.tokens.findOneAndDelete({ hash: this.hash(body.refresh_token), kind: "refresh" }).exec() : null;
      if (!stored || stored.expiresAt.getTime() < Date.now()) throw new Error("invalid_grant: refresh token is unknown or expired");
      if (body.client_id && body.client_id !== stored.clientId) throw new Error("invalid_client");
      return this.mint(stored.clientId, stored.scope);
    }
    if (body.grant_type !== "authorization_code") throw new Error("unsupported_grant_type");
    const entry = body.code ? this.codes.get(body.code) : undefined;
    if (!entry || entry.expires < Date.now()) throw new Error("invalid_grant: code is unknown or expired");
    this.codes.delete(body.code!);
    if (!body.code_verifier) throw new Error("invalid_request: code_verifier is required");
    if (createHash("sha256").update(body.code_verifier).digest("base64url") !== entry.code_challenge) throw new Error("invalid_grant: PKCE verification failed");
    if (body.redirect_uri && body.redirect_uri !== entry.redirect_uri) throw new Error("invalid_grant: redirect_uri mismatch");
    if (body.client_id && body.client_id !== entry.client_id) throw new Error("invalid_client");
    return this.mint(entry.client_id, entry.scope);
  }

  async authorize(req: Request): Promise<boolean> {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const stored = await this.tokens.findOne({ hash: this.hash(header.slice(7).trim()), kind: "access" }).exec();
      if (stored && stored.expiresAt.getTime() > Date.now()) return true;
    }
    return !this.required;
  }

  private checkLinkCode(attempt: string) {
    const current = this.linkCode;
    if (!current || current.expires < Date.now()) throw new LinkCodeError("That code has expired. Open Kanso at home to get a new one.");
    const given = Buffer.from(attempt.replace(/\D/g, "").slice(0, 6).padEnd(6, "x"));
    if (timingSafeEqual(given, Buffer.from(current.code))) return;
    current.attemptsLeft -= 1;
    if (current.attemptsLeft <= 0) {
      this.linkCode = null;
      throw new LinkCodeError("Too many wrong codes. Open Kanso at home to get a new one.");
    }
    throw new LinkCodeError("That code doesn't match. Check the code in Kanso and try again.");
  }

  private async mint(clientId: string, scope: string) {
    const access_token = randomBytes(32).toString("base64url");
    const refresh_token = randomBytes(32).toString("base64url");
    await this.tokens.insertMany([
      this.record(access_token, "access", clientId, scope, Date.now() + ACCESS_TTL_S * 1000),
      this.record(refresh_token, "refresh", clientId, scope, Date.now() + REFRESH_TTL_MS),
    ]);
    return { access_token, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token, scope };
  }

  /** The OAuth parameters carried from the authorize request through the consent form. */
  authorizeParams(source: Record<string, unknown>): Record<string, string> {
    const keys = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "scope", "state", "resource"];
    return Object.fromEntries(keys.flatMap((k) => (typeof source[k] === "string" ? [[k, source[k]]] : [])));
  }

  private record(token: string, kind: OAuthTokenKind, clientId: string, scope: string, expires: number) {
    return { hash: this.hash(token), kind, clientId, scope, expiresAt: new Date(expires) };
  }

  private hash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
