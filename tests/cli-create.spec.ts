import * as path from 'path';
import * as os from 'os';
import { TemplateLoader } from '../src/generators/TemplateLoader';

describe('CLI Create Command Templates', () => {
  it('should render controller template', async () => {
    const content = await TemplateLoader.render(
      'controller/simple.hbs',
      {
        className: 'TestController',
        moduleName: 'test',
        subPath: '..',
      },
      'modules'
    );

    expect(content).toContain('@Controller');
    expect(content).toContain('export class TestController');
    expect(content).toContain("@GetMapping('/')");
  });

  it('should render service template', async () => {
    const content = await TemplateLoader.render(
      'service/simple.hbs',
      {
        className: 'UserService',
        moduleName: 'user',
        subPath: '..',
      },
      'modules'
    );

    expect(content).toContain('@Service()');
    expect(content).toContain('export class UserService');
  });

  it('should render middleware template', async () => {
    const content = await TemplateLoader.render(
      'middleware/middleware.hbs',
      {
        module: 'auth',
      },
      'modules'
    );

    expect(content).toContain('@Middleware()');
    expect(content).toContain('export class AuthMiddleware');
  });

  it('should render dto template', async () => {
    const content = await TemplateLoader.render(
      'dto/simple.hbs',
      {
        className: 'UserDto',
        moduleName: 'user',
      },
      'modules'
    );

    expect(content).toContain('@Component()');
    expect(content).toContain('export class UserDto');
  });

  it('should render model template', async () => {
    const content = await TemplateLoader.render(
      'model/simple.hbs',
      {
        className: 'ProductEntity',
        moduleName: 'product',
        subPath: '..',
      },
      'modules'
    );

    expect(content).toContain('@Entity');
    expect(content).toContain('export class ProductEntity');
  });

  it('should render aspect template', async () => {
    const content = await TemplateLoader.render(
      'aspect/aspect.hbs',
      {
        module: 'logging',
        subPath: '..',
      },
      'modules'
    );

    expect(content).toContain('@Aspect()');
    expect(content).toContain('export class LoggingAspect');
    expect(content).toContain('app: App');
    expect(content).toContain('run()');
  });

  it('should render exception template', async () => {
    const content = await TemplateLoader.render(
      'exception/exception.hbs',
      {
        className: 'GlobalException',
        moduleName: 'global',
        subPath: '..',
      },
      'modules'
    );

    expect(content).toContain('@ExceptionHandler()');
    expect(content).toContain('export class GlobalException');
    expect(content).toContain('extends Exception');
  });

  it('should render proto template', async () => {
    const content = await TemplateLoader.render(
      'proto/proto.hbs',
      {
        className: 'User',
        moduleName: 'user',
      },
      'modules'
    );

    expect(content).toContain('syntax = "proto3"');
    expect(content).toContain('service User');
    expect(content).toContain('rpc SayHello');
  });

  it('should render plugin template', async () => {
    const content = await TemplateLoader.render(
      'plugin/plugin.hbs',
      {
        className: 'CachePlugin',
        moduleName: 'cache',
        subPath: '..',
      },
      'modules'
    );

    expect(content).toContain('@Plugin()');
    expect(content).toContain('export class CachePlugin');
    expect(content).toContain('implements IPlugin');
    expect(content).toContain('@OnEvent(AppEvent.appReady)');
    expect(content).toContain('@OnEvent(AppEvent.appStop)');
  });
});
