# CI Test Coverage Policy

## Overview

The CI pipeline enforces automated test coverage requirements for newly added and modified code across the frontend and backend applications.

The goal is to ensure that new functionality is adequately verified through automated tests and to prevent significant untested behavior from being introduced into the codebase.

Coverage is measured at two levels:

- **Overall coverage:** Ensures the frontend and backend maintain minimum coverage percentages across their included source files.
- **Changed-line coverage:** Ensures newly added and modified code meets a stricter coverage requirement before being merged.

## Coverage Mechanism

The CI pipeline uses the following tools:

| Application | Test Framework | Coverage Provider | Coverage Enforcement |
|---|---|---|---|
| Frontend | Vitest | V8 | Vitest thresholds + diff-cover |
| Backend | Jest | Jest coverage | Jest thresholds + diff-cover |

Both applications generate coverage reports in LCOV format, which are consumed by `diff-cover` to measure coverage of changed lines.

Coverage reports are generated in each application's `coverage` directory.

## Coverage Thresholds

### Overall Coverage Requirements

Both Vitest and Jest enforce the same minimum overall coverage thresholds.

| Coverage Metric | Required Threshold |
|---|---:|
| Statements | 70% |
| Branches | 60% |
| Functions | 70% |
| Lines | 70% |

These thresholds are configured independently in the frontend's Vitest configuration and the backend's Jest configuration.

If any overall coverage metric falls below its configured threshold, the corresponding test command fails.

### Changed-Line Coverage Requirements

In addition to overall coverage, the CI pipeline enforces an **80% changed-line coverage threshold**.

This requirement applies independently to both applications:

- Frontend: At least 80% coverage of changed lines.
- Backend: At least 80% coverage of changed lines.

The changed-line threshold is enforced using `diff-cover` during pull requests targeting `main`.

A pull request that falls below this threshold in either application will fail the corresponding CI job.

This stricter requirement helps ensure that newly introduced functionality receives adequate test coverage without requiring the entire existing codebase to immediately meet the same percentage.

## CI Enforcement

Coverage enforcement is integrated into the GitHub Actions CI workflow.

For pull requests targeting the `main` branch, the pipeline:

1. Checks out the repository and retrieves the Git history.
2. Installs application dependencies.
3. Runs ESLint.
4. Executes automated tests with coverage enabled.
5. Generates LCOV coverage reports.
6. Enforces the overall coverage thresholds configured in Vitest and Jest.
7. Installs `diff-cover`.
8. Compares coverage reports against changes in `origin/main`.
9. Fails the corresponding CI job if changed-line coverage is below 80%.
10. Uploads coverage reports as GitHub Actions artifacts.

Frontend and backend coverage checks run independently.

The changed-line coverage enforcement command used by both applications is:

```bash
diff-cover coverage/lcov.info --compare-branch=origin/main --fail-under=80
```

The command must be executed from the corresponding application directory.
Coverage reports are uploaded as GitHub Actions artifacts and retained for 14 days.

## Code Exclusions

Coverage collection is restricted to application source code. Certain files are excluded because they do not represent application behavior that needs to be tested through the normal automated test suite.

### Frontend 

The following lines are excluded:
```javascript
exclude: [
  'src/**/*.test.{js,jsx}',
  'src/**/*.spec.{js,jsx}',
  'src/main.jsx',
  'src/**/*.config.js'
]
```

These exclusions prevent test files, application entry-point initialization, and configuration files from affecting application coverage metrics.

### Backend

The following files are excluded:

- Test files (*.test.js)
- Specification files (*.spec.js)

These exclusions ensure that coverage metrics focus on backend application source code rather than the tests themselves.

Application logic, business rules, API functionality, and other meaningful executable behavior should remain included in coverage collection.

Exclusions should not be introduced simply to increase coverage percentages or bypass the coverage requirements.

## Running Coverage Locally

Developers should run coverage checks locally before submitting a pull request.

### Frontend

From the repository root:
```bash
cd apps/frontend
npm run test:coverage
```

This runs Vitest with coverage enabled and enforces the configured overall coverage thresholds.

To check changed-line coverage locally, install diff-cover if it is not already installed:
```bash
python -m pip install diff-cover==9.2.6
```

Fetch the latest main branch and run:
```bash
git fetch origin main
diff-cover coverage/lcov.info --compare-branch=origin/main --fail-under=80
```

### Backend

From the repository root:
```bash
cd apps/backend
npm run test:coverage
```

This runs Jest with coverage enabled and enforces the configured overall coverage thresholds.

To check changed-line coverage locally:
```bash
python -m pip install diff-cover==9.2.6
git fetch origin main
diff-cover coverage/lcov.info --compare-branch=origin/main --fail-under=80
```

The backend tests require the appropriate test environment variables. Refer to the backend test configuration and CI workflow for the required environment setup.

## Expected Behavior

| Scenario | Expected Result |
|---|---|
| Overall statements coverage falls below 70% | Fail |
| Overall branches coverage falls below 60% | Fail |
| Overall functions coverage falls below 70% | Fail |
| Overall lines coverage falls below 70% | Fail |
| Changed-line coverage is at least 80%	| Pass |
| Changed-line coverage falls below 80%	| Fail |
| New executable code has insufficient test coverage | Fail when either applicable threshold is violated |
| Frontend passes but backend fails	| Overall CI fails |
| Backend passes but frontend fails	| Overall CI fails |

A deliberately under-tested change should be capable of failing the coverage checks. This verifies that coverage enforcement actively protects the codebase rather than simply generating reports.

## Policy Maintenance
Coverage thresholds and exclusions may be adjusted as the project's testing practices evolve.

Any changes to coverage requirements or exclusions should be intentional and reflected in this documentation.

The objective is not to maximize a vanity coverage percentage. It is to ensure that newly introduced and modified application behavior receives meaningful automated test coverage before being merged into main.