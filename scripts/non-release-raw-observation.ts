import { readFile } from "node:fs/promises";

export type NonReleaseDiagnosticResult =
  | { status: "DIAGNOSTIC_AVAILABLE"; value: unknown }
  | { status: "DIAGNOSTIC_UNAVAILABLE" };

export function parseNonReleaseRawObservation(
  bytes: string | Buffer | undefined,
): NonReleaseDiagnosticResult {
  if (bytes === undefined) return { status: "DIAGNOSTIC_UNAVAILABLE" };
  try {
    return { status: "DIAGNOSTIC_AVAILABLE", value: JSON.parse(bytes.toString()) };
  } catch {
    return { status: "DIAGNOSTIC_UNAVAILABLE" };
  }
}

export async function readNonReleaseRawObservation(
  filePath: string,
): Promise<NonReleaseDiagnosticResult> {
  try {
    return parseNonReleaseRawObservation(await readFile(filePath));
  } catch {
    return { status: "DIAGNOSTIC_UNAVAILABLE" };
  }
}
