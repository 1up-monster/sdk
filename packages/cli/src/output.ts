let jsonMode = false;

export function setJsonMode(val: boolean): void {
  jsonMode = val;
}

export function print(data: unknown): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    if (typeof data === "string") {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

export function printTable(rows: Record<string, unknown>[]): void {
  if (jsonMode || rows.length === 0) {
    print(rows);
    return;
  }
  console.table(rows);
}

export function fail(message: string, exitCode = 1): never {
  if (jsonMode) {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(exitCode);
}
