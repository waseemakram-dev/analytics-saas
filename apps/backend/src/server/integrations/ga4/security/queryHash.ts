import crypto from "crypto";

/**
 * Recursively canonicalizes an object by sorting its keys.
 */
function canonicalize(val: any): any {
  if (val === null || val === undefined) {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalize);
  }
  if (typeof val === "object" && !(val instanceof Date)) {
    const sortedKeys = Object.keys(val).sort();
    const result: Record<string, any> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize(val[key]);
    }
    return result;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return val;
}

/**
 * Computes a deterministic SHA-256 hash of report parameters.
 */
export function generateQueryHash(params: Record<string, any>): string {
  const canonicalObj = canonicalize(params);
  const jsonStr = JSON.stringify(canonicalObj);
  return crypto.createHash("sha256").update(jsonStr).digest("hex");
}
