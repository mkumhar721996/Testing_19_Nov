export const MAX_NAME_LENGTH = 80;

// Returns the trimmed name, or null when it is missing, blank or too long.
export function parseName(body: unknown): string | null {
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= MAX_NAME_LENGTH ? trimmed : null;
}
