import { NextResponse } from "next/server";

const PRODUCTION_ORIGIN = "https://chalk-ebon.vercel.app";

export const INTERPRET_MAX_OUTPUT_TOKENS = 1_200;
export const SUMMARIZE_MAX_OUTPUT_TOKENS = 1_800;
export const INTERPRET_DAILY_LIMIT = 300;
export const SUMMARIZE_DAILY_LIMIT = 75;

function isAllowedOrigin(value: string) {
  try {
    const origin = new URL(value);
    if (origin.origin === PRODUCTION_ORIGIN) return true;

    return (origin.protocol === "http:" || origin.protocol === "https:")
      && (origin.hostname === "localhost" || origin.hostname === "127.0.0.1" || origin.hostname === "[::1]");
  } catch {
    return false;
  }
}

/** Rejects cross-site and headerless requests before any request body or API quota is consumed. */
export function checkAllowedOrigin(request: Request) {
  const source = request.headers.get("origin") ?? request.headers.get("referer");

  if (source && isAllowedOrigin(source)) return null;

  return NextResponse.json(
    { error: "Chalk only accepts requests from its lesson room. Open the app and try again." },
    { status: 403 },
  );
}
