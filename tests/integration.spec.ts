/**
 * Integration test for complete module generation
 */

import { GeneratorPipeline } from '../src/pipeline/GeneratorPipeline';
import { ChangeSet } from '../src/changeset/ChangeSet';
import { FileOperator } from '../src/utils/FileOperator';
import * as path from 'path';
import * as fs from 'fs';

describe('Integration: Complete Module Generation', () => {
  const specPath = path.join(__dirname, '../specs/examples/user.yml');
  const outputDir = path.join(__dirname, '../test-output');

  beforeAll(() => {
    // Clean up test output directory
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up test output directory
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('should generate all files for user module', () => {
    const pipeline = new GeneratorPipeline(specPath, {
      workingDirectory: outputDir,
    });

    const changeset = pipeline.execute();

    // Verify changeset contains expected files
    const files = changeset.getChanges();
    expect(files.length).toBeGreaterThanOrEqual(5);

    const filePaths = files.map((f) => f.path);
    expect(filePaths).toContain('src/user/model/UserModel.ts');
    expect(filePaths).toContain('src/user/dto/UserDto.ts');
    expect(filePaths).toContain('src/user/service/UserService.ts');
    expect(filePaths).toContain('src/user/controller/UserController.ts');
    expect(filePaths).toContain('src/user/index.ts');
  });

  it('should write generated files to disk', () => {
    const pipeline = new GeneratorPipeline(specPath, {
      workingDirectory: outputDir,
    });

    const changeset = pipeline.execute();

    // Apply changes manually
    for (const change of changeset.getChanges()) {
      const fullPath = path.join(outputDir, change.path);
      if (change.type === 'create' || change.type === 'modify') {
        FileOperator.writeFile(fullPath, change.content || '', false);
      }
    }

    // Verify files exist on disk
    expect(fs.existsSync(path.join(outputDir, 'src/user/model/UserModel.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/user/dto/UserDto.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/user/service/UserService.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/user/controller/UserController.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/user/index.ts'))).toBe(true);
  });

  it('should generate valid TypeScript code', () => {
    const pipeline = new GeneratorPipeline(specPath, {
      workingDirectory: outputDir,
    });

    const changeset = pipeline.execute();

    // Apply changes manually
    for (const change of changeset.getChanges()) {
      const fullPath = path.join(outputDir, change.path);
      if (change.type === 'create' || change.type === 'modify') {
        FileOperator.writeFile(fullPath, change.content || '', false);
      }
    }

    // Read generated files and check they contain expected content
    const modelContent = fs.readFileSync(
      path.join(outputDir, 'src/user/model/UserModel.ts'),
      'utf-8'
    );
    expect(modelContent).toContain('export class UserModel');
    expect(modelContent).toContain('@Entity');
    expect(modelContent).toContain('@Column');

    const dtoContent = fs.readFileSync(path.join(outputDir, 'src/user/dto/UserDto.ts'), 'utf-8');
    expect(dtoContent).toContain('export class CreateUserDto');
    expect(dtoContent).toContain('export class UpdateUserDto');
    expect(dtoContent).toContain('export class QueryUserDto');

    const serviceContent = fs.readFileSync(
      path.join(outputDir, 'src/user/service/UserService.ts'),
      'utf-8'
    );
    expect(serviceContent).toContain('export class UserService');
    expect(serviceContent).toContain('async findAll');
    expect(serviceContent).toContain('async findById');
    expect(serviceContent).toContain('async create');
    expect(serviceContent).toContain('async update');
    expect(serviceContent).toContain('async delete');

    const controllerContent = fs.readFileSync(
      path.join(outputDir, 'src/user/controller/UserController.ts'),
      'utf-8'
    );
    expect(controllerContent).toContain('export class UserController');
    expect(controllerContent).toContain('@Controller');
    expect(controllerContent).toContain('async list');
    expect(controllerContent).toContain('async detail');
    expect(controllerContent).toContain('async create');
    expect(controllerContent).toContain('async update');
    expect(controllerContent).toContain('async remove');
  });

  it('should handle spec with inline options', () => {
    const spec = GeneratorPipeline.buildSpecFromOptions('product', {
      apiType: 'rest',
      auth: 'admin',
      softDelete: true,
      pagination: true,
    });

    const pipeline = new GeneratorPipeline(spec, {
      workingDirectory: outputDir,
    });

    // Merge inline fields
    pipeline.mergeOptions({
      inlineFieldsJson: '{"name":{"type":"string","required":true},"price":{"type":"number"}}',
    });

    const changeset = pipeline.execute();
    expect(changeset.getChanges().length).toBeGreaterThanOrEqual(5);
  });

  it('should handle validation errors for invalid spec', () => {
    const pipeline = new GeneratorPipeline(specPath);
    // Modify spec to be invalid by removing required field
    (pipeline as any).spec.module = '';

    expect(() => {
      pipeline.validateSpec();
    }).toThrow();
  });

  it('should create index.ts with proper exports', () => {
    const pipeline = new GeneratorPipeline(specPath, {
      workingDirectory: outputDir,
    });

    const changeset = pipeline.execute();

    // Apply changes manually
    for (const change of changeset.getChanges()) {
      const fullPath = path.join(outputDir, change.path);
      if (change.type === 'create' || change.type === 'modify') {
        FileOperator.writeFile(fullPath, change.content || '', false);
      }
    }

    const indexContent = fs.readFileSync(path.join(outputDir, 'src/user/index.ts'), 'utf-8');
    expect(indexContent).toContain('UserController');
    expect(indexContent).toContain('UserService');
    expect(indexContent).toContain('User');
    expect(indexContent).toContain('UserDto');
  });

  it('should include auth decorators when auth is enabled', () => {
    const pipeline = new GeneratorPipeline(specPath, {
      workingDirectory: outputDir,
    });

    const changeset = pipeline.execute();

    // Apply changes manually
    for (const change of changeset.getChanges()) {
      const fullPath = path.join(outputDir, change.path);
      if (change.type === 'create' || change.type === 'modify') {
        FileOperator.writeFile(fullPath, change.content || '', false);
      }
    }

    const controllerContent = fs.readFileSync(
      path.join(outputDir, 'src/user/controller/UserController.ts'),
      'utf-8'
    );
    // user.yml has auth enabled, so check for auth import
    expect(controllerContent).toContain('Auth');
    expect(controllerContent).toContain('Roles');
  });
});
