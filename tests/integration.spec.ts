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

  it('should generate all files for user module', async () => {
    const pipeline = new GeneratorPipeline(specPath, {
      workingDirectory: outputDir,
    });

    const changeset = await pipeline.execute();

    // Verify changeset contains expected files
    const files = changeset.getChanges();
    expect(files.length).toBeGreaterThanOrEqual(4);

    const filePaths = files.map((f) => f.path);
    expect(filePaths).toContain('src/model/UserModel.ts');
    expect(filePaths).toContain('src/dto/UserDto.ts');
    expect(filePaths).toContain('src/service/UserService.ts');
    expect(filePaths).toContain('src/controller/UserController.ts');
    // user.yml 中 auth.enabled: true，会额外生成 AuthAspect
    expect(filePaths).toContain('src/aspect/AuthAspect.ts');
  });

  it('should write generated files to disk', async () => {
    const pipeline = new GeneratorPipeline(specPath, {
      workingDirectory: outputDir,
    });

    const changeset = await pipeline.execute();

    // Apply changes manually
    for (const change of changeset.getChanges()) {
      const fullPath = path.join(outputDir, change.path);
      if (change.type === 'create' || change.type === 'modify') {
        FileOperator.writeFile(fullPath, change.content || '', false);
      }
    }

    // Verify files exist on disk
    expect(fs.existsSync(path.join(outputDir, 'src/model/UserModel.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/dto/UserDto.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/service/UserService.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'src/controller/UserController.ts'))).toBe(true);
  });

  it('should generate valid TypeScript code', async () => {
    const pipeline = new GeneratorPipeline(specPath, {
      workingDirectory: outputDir,
    });

    const changeset = await pipeline.execute();

    // Apply changes manually
    for (const change of changeset.getChanges()) {
      const fullPath = path.join(outputDir, change.path);
      if (change.type === 'create' || change.type === 'modify') {
        FileOperator.writeFile(fullPath, change.content || '', false);
      }
    }

    // Read generated files and check they contain expected content
    const modelContent = fs.readFileSync(
      path.join(outputDir, 'src/model/UserModel.ts'),
      'utf-8'
    );
    expect(modelContent).toContain('export class UserModel');
    expect(modelContent).toContain('@Entity');
    expect(modelContent).toContain('@Column');

    const dtoContent = fs.readFileSync(path.join(outputDir, 'src/dto/UserDto.ts'), 'utf-8');
    expect(dtoContent).toContain('export class CreateUserDto');
    expect(dtoContent).toContain('export class UpdateUserDto');
    expect(dtoContent).toContain('export class QueryUserDto');

    const serviceContent = fs.readFileSync(
      path.join(outputDir, 'src/service/UserService.ts'),
      'utf-8'
    );
    expect(serviceContent).toContain('export class UserService');
    expect(serviceContent).toContain('async findAll');
    expect(serviceContent).toContain('async findById');
    expect(serviceContent).toContain('async create');
    expect(serviceContent).toContain('async update');
    expect(serviceContent).toContain('async delete');

    const controllerContent = fs.readFileSync(
      path.join(outputDir, 'src/controller/UserController.ts'),
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

  it('should handle spec with inline options', async () => {
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

    const changeset = await pipeline.execute();
    expect(changeset.getChanges().length).toBeGreaterThanOrEqual(4);
  });

  it('should handle validation errors for invalid spec', () => {
    const pipeline = new GeneratorPipeline(specPath);
    // Modify spec to be invalid by removing required field
    (pipeline as any).spec.module = '';

    expect(() => {
      pipeline.validateSpec();
    }).toThrow();
  });

  it('should generate service with TypeORM findAndCount', async () => {
    const pipeline = new GeneratorPipeline(specPath, {
      workingDirectory: outputDir,
    });

    const changeset = await pipeline.execute();

    for (const change of changeset.getChanges()) {
      const fullPath = path.join(outputDir, change.path);
      if (change.type === 'create' || change.type === 'modify') {
        FileOperator.writeFile(fullPath, change.content || '', false);
      }
    }

    const serviceContent = fs.readFileSync(
      path.join(outputDir, 'src/service/UserService.ts'),
      'utf-8'
    );
    // 使用 TypeORM 标准 API
    expect(serviceContent).toContain('findAndCount');
    expect(serviceContent).toContain('skip:');
    expect(serviceContent).toContain('take:');
    expect(serviceContent).toContain('findOneBy');
    // 不应包含不存在的 API
    expect(serviceContent).not.toContain('.list(');
    expect(serviceContent).not.toContain('.get(');
    expect(serviceContent).not.toContain('.add(');
  });

  it('should not include @Auth or @Roles decorators', async () => {
    const pipeline = new GeneratorPipeline(specPath, {
      workingDirectory: outputDir,
    });

    const changeset = await pipeline.execute();

    for (const change of changeset.getChanges()) {
      const fullPath = path.join(outputDir, change.path);
      if (change.type === 'create' || change.type === 'modify') {
        FileOperator.writeFile(fullPath, change.content || '', false);
      }
    }

    const controllerContent = fs.readFileSync(
      path.join(outputDir, 'src/controller/UserController.ts'),
      'utf-8'
    );
    // 框架不提供 @Auth/@Roles，由项目自行实现
    expect(controllerContent).not.toContain('@Auth');
    expect(controllerContent).not.toContain('@Roles');
  });

  it('should generate AuthAspect and @Before when auth is enabled', async () => {
    const spec = GeneratorPipeline.buildSpecFromOptions('order', {
      apiType: 'rest',
      auth: 'admin',
      softDelete: false,
      pagination: true,
    });

    const pipeline = new GeneratorPipeline(spec, {
      workingDirectory: outputDir,
    });

    // 需要至少一个 field 才能通过验证
    pipeline.mergeOptions({
      inlineFieldsJson: '{"name":{"type":"string","required":true},"price":{"type":"number"}}',
    });

    const changeset = await pipeline.execute();

    const filePaths = changeset.getChanges().map((f) => f.path);

    // auth 启用时应生成 AuthAspect 切面文件
    expect(filePaths).toContain('src/aspect/AuthAspect.ts');

    // Controller 中应使用 @Before("AuthAspect")
    const controllerChange = changeset.getChanges().find((f) => f.path.includes('Controller'));
    expect(controllerChange?.content).toContain('@BeforeEach("AuthAspect")');
    expect(controllerChange?.content).not.toContain('@Auth');
    expect(controllerChange?.content).not.toContain('@Roles');
  });
});
