export function handleError({ error }) {
  const msg = error?.message ?? '';
  if (msg.includes('dynamically imported module') || msg.includes('Failed to fetch')) {
    window.location.reload();
    return { message: 'Updating — one moment.' };
  }
  return { message: 'An error occurred.' };
}
