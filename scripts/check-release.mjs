// Runs before `npm run dist` (the signed release build): stops a release that
// would ship placeholder text. dist:unsigned skips it, for checking the packaging.
import fs from 'node:fs';

const problems = [];
const license = fs.readFileSync('build/license.txt', 'utf8');
for (const placeholder of license.match(/\[[A-Z][A-Z ]+\]/g) ?? []) {
  problems.push(`build/license.txt still has ${placeholder}`);
}

if (problems.length) {
  console.error(`Not ready to release:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
