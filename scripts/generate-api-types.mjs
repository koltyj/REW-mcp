// Generate TypeScript types from the REW REST API Swagger document.
//
// Fetches the live spec from a running REW instance (default
// http://127.0.0.1:4735/doc.json) and generates data-contract types with
// swagger-typescript-api into src/api/generated/rew-api.ts.
//
// The Swagger document itself is intentionally NOT committed. It is fetched at
// generation time, lightly patched in memory (REW's spec sets an invalid
// `info.termsOfService`, which the swagger2openapi step rejects), and passed to
// the generator programmatically so no temp spec file touches the repo.
//
// Re-run with REW running: `npm run gen:api`.
//
// Note: these types mirror what the spec DECLARES. REW's live responses deviate
// in places (e.g. POST /groups is documented as APIResponse but returns
// GroupInfo); keep those live-verified corrections in ../schemas.ts.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateApi } from 'swagger-typescript-api';

const SPEC_URL = process.env.REW_DOC_URL ?? 'http://127.0.0.1:4735/doc.json';
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src/api/generated');
const OUT_NAME = 'rew-api.ts';

async function main() {
  const res = await fetch(SPEC_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${SPEC_URL}: HTTP ${res.status}`);
  }
  const spec = await res.json();

  // REW's spec sets info.termsOfService to a non-URL string, which
  // swagger2openapi (used internally) rejects. Drop the offending metadata; it
  // has no effect on the generated types.
  if (spec.info) {
    delete spec.info.termsOfService;
  }

  await generateApi({
    spec,
    output: OUT_DIR,
    fileName: OUT_NAME,
    generateClient: false, // types only, no fetch/axios client
    generateRouteTypes: false,
    extractEnums: true,
    extractRequestParams: false,
    silent: true,
  });

  console.error(`Wrote generated types to ${resolve(OUT_DIR, OUT_NAME)}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
