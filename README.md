# makage

<p align="center">
  <img src="https://raw.githubusercontent.com/hyperweb-io/makage/refs/heads/main/docs/img/logo.svg" width="80">
  <br />
  Tiny build helper for monorepo packages
  <br />
  <a href="https://github.com/hyperweb-io/makage/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/hyperweb-io/makage/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/hyperweb-io/makage/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg">
  </a>
</p>

`makage` is a tiny, cross-platform build helper that replaces common build tools like `cpy` and `rimraf` with zero dependencies. It provides essential commands for managing package builds in monorepos.

> **makage** = `make` + `package`. A delightful portmanteau, like brunch for build tools—except makage actually gets things done.

## Features

- **One-command builds** - `makage build` runs clean, TypeScript compilation, and asset copying
- **Development mode** - Add `--dev` for source maps and faster iteration
- **Glob pattern support** - Copy files using patterns like `src/**/*.sql` (replacement for `copyfiles`)
- **Cross-platform copy** - Copy files with `--flat` and `--footer` options (replacement for `cpy`)
- **Cross-platform clean** - Recursively remove directories (replacement for `rimraf`)
- **README + Footer concatenation** - Combine README with footer content before publishing
- **Assets helper** - One-command copying of LICENSE, README, and package.json
- **Build TypeScript helper** - Run both CJS and ESM TypeScript builds
- **ESM specifier rewrite** - Optionally rewrite extensionless relative imports to Node-compatible `.js` specifiers
- **Update workspace dependencies** - Automatically convert internal package references to `workspace:*`
- **Zero dependencies** - Uses only Node.js built-in modules

## Install

```sh
npm install makage
```

## Quick Start

Replace your existing build scripts with `makage`:

```json
{
  "scripts": {
    "build": "makage build",
    "build:dev": "makage build --dev",
    "prepublishOnly": "npm run build"
  }
}
```

## Before & After

See how `makage` simplifies your build scripts:

### Development Builds

**Before:**
```json
"build:dev": "npm run clean; tsc -p tsconfig.json --declarationMap; tsc -p tsconfig.esm.json --declarationMap; npm run copy"
```

**After:**
```json
"build:dev": "makage build --dev"
```

Or if you need more control:
```json
"build:dev": "makage clean && makage build-ts --dev && makage copy"
```

### Copying Files

**Before:**
```json
"copy": "copyfiles -f ../../LICENSE README.md package.json dist"
```

**After:**
```json
"copy": "makage copy ../../LICENSE README.md package.json dist --flat"
```

**Bonus:** Add `--footer` to automatically concatenate your README with a footer:
```json
"copy": "makage copy ../../LICENSE README.md package.json dist --flat --footer"
```

### Copying with Glob Patterns

**Before:**
```json
"copy:sql": "copyfiles -f src/migrate/sql/* dist/migrate/sql && copyfiles -f src/migrate/sql/* dist/esm/migrate/sql"
```

**After:**
```json
"copy:sql": "makage copy src/migrate/sql/* dist/migrate/sql --flat && makage copy src/migrate/sql/* dist/esm/migrate/sql --flat"
```

Or with recursive patterns:
```json
"copy:all-sql": "makage copy src/**/*.sql dist/sql --flat"
```

> **Note:** For convenience, `makage assets` combines copy + footer functionality and is kept for backwards compatibility.

## Usage

### CLI Commands

```bash
# Full build (clean + build-ts + assets)
makage build

# Full build with development mode (adds --declarationMap)
makage build --dev

# Clean build directories (defaults to "dist")
makage clean
makage clean dist build temp  # or specify multiple directories

# Build TypeScript (both CJS and ESM)
makage build-ts

# Build TypeScript with source maps for development
makage build-ts --dev

# Build with Node-compatible ESM specifier rewrite
makage build --rewrite-esm-specifiers
makage build-ts --rewrite-esm-specifiers

# Copy files to destination
makage copy ../../LICENSE README.md package.json dist --flat

# Copy files with glob patterns
makage copy src/migrate/sql/* dist/migrate/sql --flat
makage copy src/**/*.sql dist/sql --flat

# Copy with automatic README + footer concatenation
makage copy ../../LICENSE README.md package.json dist --flat --footer

# Copy standard assets (LICENSE, package.json, README+FOOTER)
makage assets

# Concatenate README with footer (lower-level command)
makage readme-footer --source README.md --footer FOOTER.md --dest dist/README.md

# Update workspace dependencies
makage update-workspace
```

## Documentation

For detailed usage and API documentation, see [packages/makage/README.md](./packages/makage/README.md).

## Development

### Setup

1. Clone the repository:

```bash
git clone https://github.com/hyperweb-io/makage.git
```

2. Install dependencies:

```bash
cd makage
pnpm install
pnpm build
```

3. Test the package:

```bash
cd packages/makage
pnpm test:watch
```

## Credits

Built for developers, with developers.  
👉 https://launchql.com | https://hyperweb.io

## Disclaimer

AS DESCRIBED IN THE LICENSES, THE SOFTWARE IS PROVIDED "AS IS", AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND.

No developer or entity involved in creating this software will be liable for any claims or damages whatsoever associated with your use, inability to use, or your interaction with other users of the code, including any direct, indirect, incidental, special, exemplary, punitive or consequential damages, or loss of profits, cryptocurrencies, tokens, or anything else of value.
