export function chromiumSecureContextArgs(baseURL: string): string[] {
  const origin = new URL(baseURL);
  const loopback =
    origin.hostname === "localhost" ||
    origin.hostname === "::1" ||
    origin.hostname.startsWith("127.");
  if (origin.protocol === "https:" || loopback) return [];
  if (origin.protocol !== "http:") {
    throw new Error(`Unsupported Playwright app origin: ${origin.origin}`);
  }
  return [`--unsafely-treat-insecure-origin-as-secure=${origin.origin}`];
}
