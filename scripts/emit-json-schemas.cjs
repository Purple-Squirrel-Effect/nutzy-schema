/**
 * Emit JSON Schema files alongside the compiled JS so consumers can import
 * them directly via the `@nutzy/schema/job.schema.json` and
 * `@nutzy/schema/company.schema.json` subpath exports — no local
 * regeneration required.
 *
 * Runs after `tsc` (see package.json `build` script) so it can require the
 * already-compiled `dist/index.js`.
 */
const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { jobSchema, companySchema } = require('../dist/index.js');

const distDir = path.join(__dirname, '..', 'dist');

for (const [name, schema] of [
	['job', jobSchema],
	['company', companySchema],
]) {
	const json = z.toJSONSchema(schema, { unrepresentable: 'any' });
	const file = path.join(distDir, `${name}.schema.json`);
	fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
	console.log(`✓ dist/${name}.schema.json`);
}
