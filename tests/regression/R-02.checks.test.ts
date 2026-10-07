import * as fs from 'fs';
import * as path from 'path';
import { runChecks } from '../../src/checks/rules';
import { cleanup, makeKoattyFixture } from '../helpers';

const SERVICE_OK = `import { Service } from 'koatty';\n@Service()\nexport class OrderService {}\n`;
const DTO_GOOD = `import { IsString } from 'class-validator';\nexport class CreateOrderDto {\n  @IsString()\n  sku!: string;\n}\n`;
const DTO_BAD = `import { IsString } from 'class-validator';\nexport class MisnamedDto {\n  @IsString()\n  sku!: string;\n}\n`;

describe('R-02: Koatty 框架检查规则', () => {
  it('KOATTY_DTO_LOADER_NAME：类名与文件名一致通过，不一致报 error', () => {
    const root = makeKoattyFixture('r02-dto');
    try {
      fs.writeFileSync(path.join(root, 'src/dto/CreateOrderDto.ts'), DTO_GOOD);
      expect(runChecks(root).filter((d) => d.ruleId === 'KOATTY_DTO_LOADER_NAME')).toEqual([]);

      fs.writeFileSync(path.join(root, 'src/dto/OrderQueryDto.ts'), DTO_BAD);
      const diagnostics = runChecks(root).filter((d) => d.ruleId === 'KOATTY_DTO_LOADER_NAME');
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        deterministic: true,
        file: 'src/dto/OrderQueryDto.ts',
        suggestion: expect.stringContaining('OrderQueryDto'),
      });
      expect(diagnostics[0].message).toContain('MisnamedDto');
    } finally {
      cleanup(root);
    }
  });

  it('KOATTY_GLOBAL_IOC：src 内使用全局容器告警；re-export 不误报', () => {
    const root = makeKoattyFixture('r02-ioc');
    try {
      fs.writeFileSync(
        path.join(root, 'src/service/BadService.ts'),
        `import { IOC, Service } from 'koatty_container';\n@Service()\nexport class BadService {\n  find() {\n    return IOC.get('x');\n  }\n}\n`
      );
      fs.writeFileSync(
        path.join(root, 'src/service/Reexport.ts'),
        `export { IOC } from 'koatty_container';\n`
      );
      const diagnostics = runChecks(root).filter((d) => d.ruleId === 'KOATTY_GLOBAL_IOC');
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'warning',
        deterministic: true,
        file: 'src/service/BadService.ts',
      });
      expect(diagnostics[0].suggestion).toContain('app.container');
    } finally {
      cleanup(root);
    }
  });

  it('KOATTY_DUP_ROUTE：静态重复路由告警；动态路由不下结论', () => {
    const root = makeKoattyFixture('r02-route');
    try {
      fs.writeFileSync(
        path.join(root, 'src/controller/OrderController.ts'),
        `import { Controller, GetMapping } from 'koatty';\n@Controller('/orders')\nexport class OrderController {\n  @GetMapping('/:id')\n  detail() { return 1; }\n}\n`
      );
      fs.writeFileSync(
        path.join(root, 'src/controller/Order2Controller.ts'),
        `import { Controller, GetMapping } from 'koatty';\n@Controller('/orders')\nexport class Order2Controller {\n  @GetMapping('/:id')\n  detail() { return 2; }\n}\n`
      );
      const diagnostics = runChecks(root).filter((d) => d.ruleId === 'KOATTY_DUP_ROUTE');
      expect(diagnostics.length).toBe(2); // 两个文件各报一次
      expect(diagnostics.every((d) => d.deterministic)).toBe(true);

      // 动态路径（模板字符串）不进入事实收集，也不报错
      fs.writeFileSync(
        path.join(root, 'src/controller/Order3Controller.ts'),
        'import { Controller, GetMapping } from "koatty";\n@Controller("/dyn")\nexport class Order3Controller {\n  @GetMapping(basePath + "/x")\n  dynamic() { return 3; }\n}\n'
      );
      const after = runChecks(root).filter((d) => d.ruleId === 'KOATTY_DUP_ROUTE');
      expect(JSON.stringify(after)).not.toContain('Order3Controller');
    } finally {
      cleanup(root);
    }
  });

  it('正常项目零诊断；未知规则拒绝', () => {
    const root = makeKoattyFixture('r02-clean', { service: SERVICE_OK });
    try {
      expect(runChecks(root)).toEqual([]);
      expect(() => runChecks(root, { rules: ['NOT_A_RULE'] })).toThrow(/Unknown check rules/);
    } finally {
      cleanup(root);
    }
  });
});
