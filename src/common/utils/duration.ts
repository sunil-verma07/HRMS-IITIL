const DURATION_PATTERN = /^(\d+)([smhd])$/;

const multipliers = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
} as const;

export function addDuration(date: Date, duration: string): Date {
  const match = DURATION_PATTERN.exec(duration);

  if (!match) {
    throw new Error(`Unsupported duration format: ${duration}`);
  }

  const [, value, unit] = match;
  return new Date(date.getTime() + Number(value) * multipliers[unit as keyof typeof multipliers]);
}
