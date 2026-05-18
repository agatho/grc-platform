// Standalone runner for the Programme-Templates seed.
//
// Why a runner file?  The deploy script previously used `npx tsx -e
// "import(...).then(m => m.seedProgrammeTemplates())..."`.  In tsx 4.x
// the dynamic import inside an inline `-e` eval does not consistently
// trigger the TS loader hooks, so the named export was sometimes
// `undefined` ("m.seedProgrammeTemplates is not a function").  Invoking
// a real file works reliably because tsx loads it through its normal
// resolver.

import { seedProgrammeTemplates } from "./programme-templates";

async function main() {
  const r = await seedProgrammeTemplates();
  console.log(JSON.stringify(r));
}

main().catch((err) => {
  console.error("programme-templates failed:", (err as Error).message);
  process.exit(1);
});
