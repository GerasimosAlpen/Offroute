import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

/**
 * Protects destructive admin endpoints.
 *
 * Context: this server has no authentication layer of any kind — no guards, no
 * JWT, no API key — across all 34 REST endpoints, and it points at a shared
 * hosted Supabase instance. `POST /admin/reseed` runs `deleteMany({})` over
 * every table. Until a real auth system exists (see TODO.md "Login / auth —
 * deferred"), a shared secret on the one endpoint that can destroy everyone's
 * data is the minimum that should be in place.
 *
 * Deliberately fails CLOSED. If ADMIN_TOKEN is not configured the endpoint is
 * unavailable rather than open, because the alternative — defaulting to open
 * when a variable is missing — is exactly how the data gets wiped by accident.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  private readonly logger = new Logger(AdminTokenGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_TOKEN;

    if (!expected) {
      this.logger.error(
        "ADMIN_TOKEN is not set — refusing the request. Set it in the server " +
          "environment (see .env.example) to enable destructive admin endpoints.",
      );
      throw new ServiceUnavailableException(
        "Admin endpoints are disabled: the server has no ADMIN_TOKEN configured.",
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header("x-admin-token");

    if (!provided || !timingSafeEqual(provided, expected)) {
      this.logger.warn(
        `Rejected admin request to ${request.method} ${request.url} from ${request.ip}`,
      );
      throw new UnauthorizedException("Invalid or missing x-admin-token header.");
    }

    return true;
  }
}

/**
 * Length-independent constant-time comparison, so a wrong token cannot be
 * recovered by measuring how long the rejection took.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}
