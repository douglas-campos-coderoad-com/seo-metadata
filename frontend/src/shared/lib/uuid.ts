import { v4 as uuidv4 } from 'uuid';

/**
 * `crypto.randomUUID()` is only defined in secure contexts (https, or
 * http://localhost) — accessing the app via a LAN IP or non-localhost
 * hostname over plain http leaves it undefined. `uuid`'s v4 generator
 * only needs `crypto.getRandomValues`, which is available everywhere,
 * so it works as a drop-in replacement in insecure contexts too.
 */
export function randomUUID(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : uuidv4();
}
