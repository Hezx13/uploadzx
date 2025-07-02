# uploadzx Examples

This directory contains example implementations of uploadzx in different environments and frameworks.

## Available Examples

### 🚀 React + Vite (`react-vite/`)
A complete React application demonstrating uploadzx React integration with hooks and components.

- **Framework**: React 19 + Vite
- **Features**: Hooks, Context Provider, Drag & Drop Component
- **Port**: http://localhost:3000

### 📦 Vanilla JavaScript + Vite (`vanilla-vite/`)
A vanilla JavaScript/TypeScript implementation using the core uploadzx library.

- **Framework**: Vanilla TypeScript + Vite
- **Features**: Direct API usage, DOM manipulation
- **Port**: http://localhost:3001

## Quick Start

### Option 1: Run Specific Example

```bash
# Install dependencies and build library
pnpm examples:install

# Run React example
pnpm example:react

# Run Vanilla example  
pnpm example:vanilla
```

### Option 2: Manual Setup

```bash
# From project root
pnpm install
pnpm build

# Choose an example
cd examples/react-vite     # or examples/vanilla-vite
pnpm dev
```

## Workspace Structure

The examples use pnpm workspaces to:

✅ **Separate Dependencies**: Each example has its own `package.json` with framework-specific dependencies

✅ **Link Main Library**: Uses `"uploadzx": "workspace:*"` to reference the local library

✅ **Independent Development**: Each example can be developed and built separately

✅ **Shared Tooling**: Common tools like TypeScript are shared across workspaces

## Example Features

All examples demonstrate:

- 📁 **File Selection**: Native file picker and drag & drop
- 📊 **Progress Tracking**: Real-time upload progress with visual indicators
- ⏯️ **Upload Controls**: Pause, resume, and cancel functionality
- 🔄 **Queue Management**: Multiple file uploads with concurrency control
- 💾 **Persistent State**: Upload state persisted across page refreshes
- 🚨 **Error Handling**: Comprehensive error display and handling
- 🎨 **Modern UI**: Clean, responsive interface with dark theme

## Upload Server

All examples use the demo tus server at `https://tusd.tusdemo.net/files/` for testing. This server:

- Supports resumable uploads via the tus protocol
- Automatically cleans up uploads after 24 hours
- Is free to use for testing and development
- Should be replaced with your own server in production

## Adding New Examples

To add a new example:

1. Create a new directory: `examples/your-example/`
2. Add a `package.json` with `"uploadzx": "workspace:*"`
3. Import and use uploadzx: `import Uploadzx from 'uploadzx'`
4. Add documentation in a README.md
5. Add a script to root package.json: `"example:your-example": "cd examples/your-example && pnpm dev"`

## Framework Integrations

### React
```tsx
import { UploadzxProvider, useUploadzxContext } from 'uploadzx/react'
```

### Vue (Future)
```typescript
// Future: uploadzx/vue
```

### Angular (Future)
```typescript
// Future: uploadzx/angular
```

### Vanilla JavaScript
```typescript
import Uploadzx from 'uploadzx'
``` 