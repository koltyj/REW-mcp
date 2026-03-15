# Contributing to REW MCP Server

Thank you for your interest in contributing! This document provides guidelines and information about contributing to this project.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (measurement files, configuration, etc.)
- **Describe the behavior you observed and what you expected**
- **Include your environment** (Node.js version, OS, REW version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed functionality**
- **Explain why this enhancement would be useful**
- **List any alternative solutions you've considered**

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes** with clear, descriptive commits
4. **Add tests** for any new functionality
5. **Ensure tests pass**: `npm test`
6. **Ensure the build passes**: `npm run build`
7. **Update documentation** if needed
8. **Submit a pull request**

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/rew-mcp.git
cd rew-mcp

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run dev
```

## Project Structure

```
rew-mcp/
├── src/
│   ├── index.ts              # Server entry point
│   ├── api/                   # REW API client
│   ├── tools/                 # MCP tool handlers
│   ├── analysis/              # Analysis algorithms
│   ├── interpretation/        # Plain language interpretation
│   ├── optimization/          # Placement recommendations
│   ├── session/               # Session state management
│   ├── prompts/               # MCP prompt definitions
│   ├── resources/             # MCP resource handlers
│   └── store/                 # Data storage
├── docs/                      # Documentation
└── src/**/*.test.ts           # Test files are co-located with source
```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use Zod for runtime validation
- Export types from dedicated files

### Testing

- Write tests for all new functionality
- Use Vitest for testing
- Use MSW for HTTP mocking
- Co-locate test files with source (`*.test.ts`)

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new analysis feature
fix: handle edge case in room mode detection
docs: update API documentation
test: add tests for optimization module
refactor: simplify session state management
chore: update dependencies
```

### Code Style

- Use ESLint configuration provided
- Run `npm run lint:fix` before committing
- Keep functions small and focused
- Add JSDoc comments for public APIs

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/analysis/room-modes.test.ts
```

## Documentation

- Update README.md for user-facing changes
- Update relevant docs/ files for API changes
- Add JSDoc comments for new public functions
- Include code examples where helpful

## Review Process

1. All submissions require review
2. Maintainers will review for:
   - Code quality and style
   - Test coverage
   - Documentation
   - Breaking changes
3. Address review feedback
4. Maintainers will merge when ready

## Questions?

Feel free to open an issue for questions about contributing.

---

Thank you for contributing!
