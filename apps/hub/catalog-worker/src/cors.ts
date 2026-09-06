export const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
  "https://pubecomhub.com",
  /^https:\/\/.*\.workers\.dev$/,
  /^https:\/\/.*\.pages\.dev$/,
];

export function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin) {
    const isAllowed = allowedOrigins.some((pattern) => {
      if (pattern instanceof RegExp) return pattern.test(origin);
      return pattern === origin;
    });

    if (isAllowed) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
  }

  return headers;
}

export function handleOptions(request: Request) {
  const origin = request.headers.get("Origin");
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}
