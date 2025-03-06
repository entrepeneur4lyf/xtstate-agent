import { z } from 'zod';
import { createExpert } from '../src';
import { openai } from '@ai-sdk/openai';
import { getFromTerminal } from './helpers/helpers';
import { chainOfThoughtPolicy } from '../src/policies/chainOfThoughtPolicy';

const expert = createExpert({
  id: 'chain-of-thought',
  model: openai('gpt-4o'),
  events: {
    'expert.answer': z.object({
      answer: z.string().describe('The answer to the question'),
    }),
  },
  context: {
    question: z.string().nullable(),
  },
  policy: chainOfThoughtPolicy,
});

async function main() {
  const msg = await getFromTerminal('what?');

  const decision = await expert.decide({
    messages: expert.getMessages(),
    goal: 'Answer the question.',
    state: {
      value: 'thinking',
      context: {
        question: msg,
      },
    },
  });

  console.log(decision?.nextEvent?.answer);
}

main();
