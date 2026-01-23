# Koatty AI User Guide

Koatty AI is an intelligent scaffolding tool for the Koatty framework, designed to accelerate development by generating boilerplate code (Models, DTOs, Services, Controllers) based on simple specifications.

## Installation

```bash
npm install -g koatty-ai
```

## Basic Workflow

1.  **Define Specification**: Create a `.yml` file describing your module.
2.  **Plan Changes**: Preview what will be generated.
    ```bash
    koatty-ai plan --spec user.yml
    ```
3.  **Apply Changes**: Generate the files and update project configuration.
    ```bash
    koatty-ai apply --spec user.yml --validate --commit
    ```

## Specification Format

Example `user.yml`:

```yaml
module: User
fields:
  username: string
  email: string
  age: number
  status:
    type: enum
    values: [active, inactive]
api:
  basePath: /users
features:
  softDelete: true
  pagination: true
```

## Command Reference

### `generate:module <name>`
Quickly generate a module using CLI flags.
- `--fields <json>`: JSON string of field definitions.
- `--api <type>`: `rest` or `graphql`.
- `--pagination`: Enable pagination features.

### `plan`
- `--spec <path>`: Required. Path to the spec file.

### `apply`
- `--spec <path>`: Required. Path to the spec file.
- `--validate`: Run Prettier, ESLint, and TSC on generated code (default: true).
- `--commit`: Automatically stage and commit changes (default: false).

## Quality & Validation
Koatty AI ensures generated code:
- Follows your project's **Prettier** settings.
- Passes **ESLint** rules.
- Compiles successfully via **TSC**.
