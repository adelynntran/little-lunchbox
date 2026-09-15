/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  access?: {
    aud: string;
    getIdentity(): Promise<{ email?: string } | null>;
  };
}

const OWNER_HEADER = "x-little-lunchbox-owner";

async function withVerifiedOwner(request: Request, ctx: ExecutionContext) {
  const headers = new Headers(request.headers);

  // Never trust an identity header supplied by the browser. Only Cloudflare
  // Access's verified execution context is allowed to set the database owner.
  headers.delete(OWNER_HEADER);
  if (ctx.access) {
    const identity = await ctx.access.getIdentity();
    if (identity?.email) headers.set(OWNER_HEADER, identity.email.trim().toLowerCase());
  } else {
    // Workers with Static Assets run behind Cloudflare's internal asset router,
    // which currently does not forward ctx.access. Access still authenticates
    // the request and attaches both the signed assertion and verified email.
    const assertion = request.headers.get("cf-access-jwt-assertion");
    const email = request.headers.get("cf-access-authenticated-user-email");
    if (assertion && email) headers.set(OWNER_HEADER, email.trim().toLowerCase());
  }

  return new Request(request, { headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(await withVerifiedOwner(request, ctx), env, ctx);
  },
};

export default worker;
