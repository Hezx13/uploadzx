---
title: Installation
description: Add uploadzx to your project and learn what the two entry points are for.
---

Install from npm with your package manager of choice.

```bash
# npm
npm install uploadzx

# pnpm
pnpm add uploadzx

# yarn
yarn add uploadzx
```

`tus-js-client` is bundled as a dependency. **React is an optional peer
dependency** (`react >= 16.8.0`) — you only need it if you import from
`uploadzx/react`. The package ships ESM and CJS builds plus full type
declarations.

## Entry points

| Entry point      | Import                                              | Use it for                       |
| ---------------- | --------------------------------------------------- | -------------------------------- |
| `uploadzx`       | `import Uploadzx, { TusDriver } from 'uploadzx'`    | The framework-agnostic core.     |
| `uploadzx/react` | `import { UploadzxProvider } from 'uploadzx/react'` | React provider, hooks, components.|

> [!TIP] You need a modern browser (ES2020+) at runtime. To build the library
> itself locally you need Node `>= 16`. See [Contributing](/docs/reference/contributing).

## Next

Head to the [quick start](/docs/getting-started/quick-start) to wire up your
first uploader.
