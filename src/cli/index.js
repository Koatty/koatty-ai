#!/usr/bin/env node
"use strict";
/**
 * Koatty CLI - 安装后使用: koatty <command> 或 kt <command>
 */
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const package_json_1 = require("../../package.json");
const new_1 = require("./commands/new");
const add_1 = require("./commands/add");
const generate_1 = require("./commands/generate");
const plan_1 = require("./commands/plan");
const apply_1 = require("./commands/apply");
const registerCreate_1 = require("./commands/registerCreate");
const template_1 = require("./commands/template");
const sql2yml_1 = require("./commands/sql2yml");
const program = new commander_1.Command();
program
    .name('koatty')
    .description(package_json_1.description)
    .version(package_json_1.version, '-v, --version', 'Output the current version');
// Register commands：new/project -> create*(单文件) -> add -> plan -> apply -> generate:module
(0, new_1.registerNewCommand)(program);
(0, registerCreate_1.registerCreateCommands)(program);
(0, add_1.registerAddCommand)(program);
(0, generate_1.registerGenerateCommand)(program);
(0, plan_1.registerPlanCommand)(program);
(0, apply_1.registerApplyCommand)(program);
(0, template_1.registerTemplateCommand)(program);
(0, sql2yml_1.registerSql2YmlCommand)(program);
program.parse(process.argv);
// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
//# sourceMappingURL=index.js.map