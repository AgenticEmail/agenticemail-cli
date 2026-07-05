# Contributing

Thanks for your interest in the AgenticEmail CLI.

This repository is an exported snapshot of the CLI developed in the AgenticEmail monorepo, so pull requests may be ported rather than merged directly. Issues and PRs are welcome either way.

## Development

```bash
bun install
bun run build   # tsup → dist/cli.js
bun test        # bun test runner
node dist/cli.js help
```

Please keep changes small and include a test when you fix a bug (see `tests/lib.test.ts` for the style).
