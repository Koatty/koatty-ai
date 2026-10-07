import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { applyPlan, preparePlan } from 'koatty_cli/generation';
import { resolveInside } from 'koatty_cli/project';
import { aiResult, AiOperationError } from '../result';
import { AiToolDefinition } from './registry';

/** Explicit project installation; never edits a user's global skills or replaces local changes. */
export function skillTool(): AiToolDefinition {
  return {
    name: 'koatty_ai_skill', command: 'skill',
    description: 'Preview/install the bundled Koatty Skill into .agents/skills/koatty. Existing different files are never overwritten.',
    inputSchema: { type: 'object', properties: { root: { type: 'string' }, yes: { type: 'boolean' } }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false }, executesProjectCode: false,
    handler: async (input, ctx) => {
      const source = path.resolve(__dirname, '../../skills/koatty');
      const changes: Array<{type:'create';path:string;content:string}> = [];
      const files: Array<{path:string;sha256:string}> = [];
      const walk = (dir: string) => {
        for (const item of fs.readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
          const file = path.join(dir,item.name);
          if (item.isSymbolicLink()) throw new AiOperationError('INVALID_SKILL','Bundled skill contains a symlink');
          if (item.isDirectory()) { walk(file); continue; }
          const relative = path.relative(source,file).split(path.sep).join('/');
          const dest = `.agents/skills/koatty/${relative}`;
          const content = fs.readFileSync(file,'utf8');
          const target = resolveInside(ctx.projectRoot,dest);
          files.push({path:dest,sha256:createHash('sha256').update(content).digest('hex')});
          if (fs.existsSync(target)) {
            if (fs.readFileSync(target,'utf8') !== content) throw new AiOperationError('SKILL_CONFLICT', `Existing Skill differs: ${dest}`, 'Review local changes and merge explicitly; the installer will not overwrite them.');
          } else changes.push({type:'create',path:dest,content});
        }
      };
      walk(source);
      if (!changes.length) return aiResult('skill','completed',{files,changed:[],note:'Installed Skill matches this package.'});
      const plan = preparePlan(ctx.projectRoot,{module:'koatty-skill',changes});
      const receipt = applyPlan(ctx.projectRoot,plan,input.yes !== true);
      return aiResult('skill',input.yes ? 'applied' : 'preview',{...receipt,files,note:'Enable the project Skill in your host if it does not discover .agents/skills automatically.'});
    },
  };
}
