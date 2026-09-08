const PACKAGE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;

export function buildDappStoreDeepLink(packageName: string | null | undefined): string | null {
  if (!packageName || typeof packageName !== "string") return null;
  const normalized = packageName.trim();
  if (!normalized || !PACKAGE_NAME_RE.test(normalized)) return null;
  return `solanadappstore://details?id=${encodeURIComponent(normalized)}`;
}
