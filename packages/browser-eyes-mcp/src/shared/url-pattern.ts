/**
 * URL pattern canonicalization for getNetworkRequests grouping.
 * Converts concrete URLs like /api/users/123 into patterns like /api/users/:id.
 */

export function canonicalizeUrl(rawUrl: string): string {
  let pathname: string;
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    pathname = parsed.pathname;
  } catch {
    pathname = rawUrl;
  }

  const segments = pathname.split('/').filter(Boolean);

  const canonized = segments.map((seg) => {
    // UUID: 8-4-4-4-12 hex
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        seg,
      )
    ) {
      return ':uuid';
    }
    // Hex hash (12+ hex chars), optionally with file extension
    if (/^[0-9a-f]{12,}(\.[a-z0-9]+)?$/i.test(seg)) return ':hash';
    // Numeric ID
    if (/^\d+$/.test(seg)) return ':id';
    // Keep as-is
    return seg;
  });

  return '/' + canonized.join('/');
}
