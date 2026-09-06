export function streamFields(data: Record<string, unknown>) {
  return Object.entries(data).flatMap(([key, value]) => [
    key,
    typeof value === "string" ? value : JSON.stringify(value)
  ]);
}

export function parseFields(fields: string[]) {
  const data: Record<string, any> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const value = fields[i + 1];
    try {
      data[fields[i]] = JSON.parse(value);
    } catch {
      data[fields[i]] = value;
    }
  }
  return data;
}

