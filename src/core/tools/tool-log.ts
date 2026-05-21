export function logToolEvent(
  message: string,
  meta?: Record<string, string | undefined>,
): void {
  process.stdout.write(
    `${JSON.stringify({ level: 'info', message, ...meta, ts: new Date().toISOString() })}\n`,
  );
}
