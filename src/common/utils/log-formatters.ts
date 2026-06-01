function splitWords(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function humanizeLabel(value: string): string {
  const normalized = splitWords(value);

  if (!normalized) {
    return 'Unknown';
  }

  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function notificationTitleFromType(type: string): string {
  return humanizeLabel(type);
}

export function summarizeActivityLog(entry: {
  action: string;
  entityType: string;
  entityName?: string | null;
}): string {
  const action = humanizeLabel(entry.action);
  const entity = entry.entityName?.trim() || humanizeLabel(entry.entityType);

  return entity ? `${action} - ${entity}` : action;
}

export function summarizeAuditLog(entry: {
  event: string;
  action?: string | null;
  entityType?: string | null;
}): string {
  const verb = humanizeLabel(entry.action ?? entry.event);
  const entity = entry.entityType?.trim() ? humanizeLabel(entry.entityType) : '';

  return entity ? `${verb} - ${entity}` : verb;
}