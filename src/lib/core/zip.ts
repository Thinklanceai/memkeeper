/**
 * Hardened ZIP handling — same guards as agentkeeper.importers.base.
 * Archives are read entirely in memory via fflate; nothing touches a
 * server or the filesystem. Zip-bomb limits (member count, declared
 * sizes) and path-traversal rejection before any member is inflated.
 */

import { unzipSync, type Unzipped } from "fflate";
import { ImportError } from "./types";

export const MAX_ZIP_MEMBERS = 10_000;
export const MAX_MEMBER_UNCOMPRESSED_BYTES = 1_073_741_824;
export const MAX_TOTAL_UNCOMPRESSED_BYTES = 2_147_483_648;

export function readZip(data: Uint8Array): Unzipped {
  let unzipped: Unzipped;
  try {
    unzipped = unzipSync(data, {
      filter: (file) => {
        const name = file.name;
        if (
          name.startsWith("/") ||
          name.startsWith("\\") ||
          name.split("/").includes("..")
        ) {
          throw new ImportError(`Unsafe member path in archive: ${name}`);
        }
        if (file.originalSize > MAX_MEMBER_UNCOMPRESSED_BYTES) {
          throw new ImportError(
            `Member ${name} declares ${file.originalSize} uncompressed ` +
              `bytes (limit ${MAX_MEMBER_UNCOMPRESSED_BYTES}).`,
          );
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof ImportError) throw err;
    throw new ImportError(
      `Not a valid ZIP archive: ${err instanceof Error ? err.message : err}`,
    );
  }

  const names = Object.keys(unzipped);
  if (names.length > MAX_ZIP_MEMBERS) {
    throw new ImportError(
      `Archive has ${names.length} members (limit ${MAX_ZIP_MEMBERS}); ` +
        "refusing to read.",
    );
  }
  let total = 0;
  for (const name of names) total += unzipped[name].length;
  if (total > MAX_TOTAL_UNCOMPRESSED_BYTES) {
    throw new ImportError(
      `Archive holds ${total} total uncompressed bytes ` +
        `(limit ${MAX_TOTAL_UNCOMPRESSED_BYTES}).`,
    );
  }
  return unzipped;
}

/** Find a member by basename, optionally preferring paths matching markers. */
export function findMember(
  unzipped: Unzipped,
  basename: string,
  preferMarkers: string[] = [],
): string | null {
  const candidates = Object.keys(unzipped).filter(
    (n) => n.split("/").pop() === basename,
  );
  if (candidates.length === 0) return null;
  if (preferMarkers.length > 0) {
    const preferred = candidates.find((n) =>
      preferMarkers.some((m) => n.toLowerCase().includes(m)),
    );
    if (preferred) return preferred;
  }
  return candidates.sort()[0];
}

const decoder = new TextDecoder("utf-8", { fatal: false });

export function decodeJson(raw: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(decoder.decode(raw));
  } catch (err) {
    throw new ImportError(
      `Invalid JSON in ${label}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

export function decodeText(raw: Uint8Array): string {
  return decoder.decode(raw);
}
