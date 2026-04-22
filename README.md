# @nutzy-org/schema

Zod schemas and inferred TypeScript types for Nutzy jobs and companies.

```ts
import {
  jobSchema,
  companySchema,
  type JobFrontmatter,
  type CompanyFrontmatter,
} from "@nutzy-org/schema";
```

## Updating the schema

1. **Edit** [src/index.ts](src/index.ts) — add/change fields on `jobSchema`, `companySchema`, or their building blocks.
2. **Build locally** to type-check:
   ```bash
   npm run build
   ```
3. **Commit and push** your changes to `main`.
4. **Bump the version** following [semver](https://semver.org/):
   - `npm version patch` — bug fix or internal-only change
   - `npm version minor` — new optional field (backwards compatible)
   - `npm version major` — removed/renamed field, or stricter validation (breaking)
5. **Push the tag** — this triggers [.github/workflows/publish.yml](.github/workflows/publish.yml) which publishes to npm via Trusted Publishers (no token needed).
   ```bash
   git push --follow-tags
   ```

## Local development

```bash
npm install
npm run build
```

Output lands in `dist/` (gitignored, npm-published).

## Consumers

`zod` is a peer dependency — installers bring their own:

```bash
npm i @nutzy-org/schema zod
```
