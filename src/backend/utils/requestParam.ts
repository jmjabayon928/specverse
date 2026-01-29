export function asSingleString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

export function parseIntParam(value: string | string[] | undefined): number | undefined {
  const str = asSingleString(value);
  if (str === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(str, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

