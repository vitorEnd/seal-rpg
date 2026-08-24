const LOCAL_ORIGIN = "http://rpg-vitin.local";
const ALLOWED_ROUTE_PREFIXES = ["/campaigns", "/admin"] as const;

export function safeReturnTo(value: string | undefined): string | null {
  if (
    !value ||
    value.length > 2048 ||
    /[\\\u0000-\u001f\u007f]/.test(value) ||
    /%5c/i.test(value)
  ) {
    return null;
  }

  let destination: URL;
  try {
    destination = new URL(value, LOCAL_ORIGIN);
  } catch {
    return null;
  }

  if (destination.origin !== LOCAL_ORIGIN) {
    return null;
  }

  const allowed = ALLOWED_ROUTE_PREFIXES.some(
    (prefix) =>
      destination.pathname === prefix ||
      destination.pathname.startsWith(`${prefix}/`),
  );

  return allowed ? `${destination.pathname}${destination.search}` : null;
}
