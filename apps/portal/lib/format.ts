export function formatDate(iso: string, style: 'short' | 'long' = 'short'): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: style === 'short' ? 'short' : 'long',
    day: 'numeric',
  });
}
