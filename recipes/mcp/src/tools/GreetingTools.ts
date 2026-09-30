import { Service } from 'koatty_core';
import { Autowired } from 'koatty_container';
import { Tool, Resource, Prompt } from 'koatty_mcp';
import { Validated } from 'koatty_validation';
import { GreetingDto } from '../dto/GreetingDto';
import { GreetingService } from '../service/GreetingService';

@Service()
export class GreetingTools {
  @Autowired() private greeting!: GreetingService;
  @Tool({
    name: 'greeting_read',
    description: 'Read the greeting without changing it.',
    scopes: ['greeting:read'],
    annotations: { readOnlyHint: true },
    outputSchema: {
      type: 'object',
      required: ['message'],
      properties: { message: { type: 'string' } },
      additionalProperties: false,
    },
  })
  read() {
    return this.greeting.read();
  }

  @Tool({
    name: 'greeting_rename',
    description: 'Change the greeting name. Requires operator approval.',
    scopes: ['greeting:write'],
    requireApproval: true,
    annotations: { destructiveHint: true },
  })
  @Validated({ types: [GreetingDto] })
  rename(input: GreetingDto) {
    return this.greeting.rename(input.name);
  }

  @Resource({
    uri: 'greeting://current',
    name: 'current-greeting',
    mimeType: 'application/json',
    scopes: ['greeting:read'],
  })
  resource() {
    return this.greeting.read();
  }

  @Prompt({
    name: 'explain_greeting',
    description: 'Explain the current greeting.',
    scopes: ['greeting:read'],
  })
  prompt() {
    return 'Use greeting_read to look up and explain the greeting.';
  }
}
