import { TemplateLoader } from '../src/generators/TemplateLoader';
import * as path from 'path';

describe('Model Template', () => {
  beforeAll(() => {
    TemplateLoader.registerHelpers();
  });

  it('should render a valid TypeORM model', async () => {
    const templatePath = path.join(__dirname, '../templates/modules/model/model.hbs');
    const template = await TemplateLoader.compileTemplate(templatePath);

    const context = {
      module: 'user',
      table: 'users',
      fields: {
        id: { type: 'number', primary: true },
        username: { type: 'string', length: 50, unique: true, required: true },
        age: { type: 'number', default: 18 },
      },
    };

    const result = template(context);
    expect(result).toContain('@Component()');
    expect(result).toContain("@Entity('users')");
    expect(result).toContain('export class UserModel');
    expect(result).toContain('extends BaseEntity');
    expect(result).toContain('@PrimaryGeneratedColumn()');
    expect(result).toContain('id: number;');
    expect(result).toContain("type: 'varchar'");
    expect(result).toContain('length: 50');
    expect(result).toContain('username: string;');
    expect(result).toContain('default:');
    expect(result).toContain('@CreateDateColumn()');
    expect(result).toContain('@UpdateDateColumn()');
  });
});
