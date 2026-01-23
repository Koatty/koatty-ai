# Example Usage Guide

This directory contains examples to help you get started with Koatty AI.

## Example 1: User Module

1.  Navigate to the root of a Koatty project.
2.  Copy `specs/examples/user.yml` to your project.
3.  Run the planning command:
    ```bash
    koatty-ai plan --spec user.yml
    ```
4.  Review the proposed changes in your terminal.
5.  Apply the changes with quality checks and git commit:
    ```bash
    koatty-ai apply --spec user.yml --validate --commit
    ```

## Example 2: Quick Inline Generation

If you don't want to create a YAML file, use the CLI directly:

```bash
koatty-ai generate:module Task --fields '{"title":"string","done":"boolean"}' --pagination
```

Then apply the resulting changeset ID shown in the output:
```bash
# Apply command currently requires --spec for simplicity in MVP, 
# but you can use the generated YAML if 'generate:module' saved one.
```
