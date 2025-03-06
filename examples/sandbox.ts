import { z } from 'zod';
import { createExpert } from '../src';
import { openai } from '@ai-sdk/openai';
import { createMachine } from 'xstate';

const expert = createExpert({
  model: openai('gpt-4o-mini'),
  events: {
    doSomething: z.object({}).describe('Do something'),
  },
});

async function main() {
  const machine = createMachine({
    on: {
      doSomething: {},
    },
  });
  const result = await expert.decide({
    goal: 'Do not do anything',
    state: { value: {}, context: {} },
    machine,
  });

  console.log(result);
}

main();
