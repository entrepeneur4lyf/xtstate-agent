import { createExpert, fromDecision } from '../src';
import { z } from 'zod';
import { setup, createActor, createMachine } from 'xstate';
import { openai } from '@ai-sdk/openai';
import { chainOfThoughtPolicy } from '../src/policies/chainOfThoughtPolicy';

const expert = createExpert({
  id: 'simple',
  model: openai('gpt-4o-mini'),
  events: {
    'expert.thought': z.object({
      text: z.string().describe('The text of the thought'),
    }),
  },
});

const machine = createMachine({
  initial: 'thinking',
  states: {
    thinking: {
      on: {
        'expert.thought': {
          actions: ({ event }) => console.log(event.text),
          target: 'thought',
        },
      },
    },
    thought: {
      type: 'final',
    },
  },
});

const actor = createActor(machine).start();

expert.onMessage(console.log);

expert.interact(actor, (obs) => {
  if (obs.state.matches('thinking')) {
    return {
      goal: 'Think about a random topic, and then share that thought.',
    };
  }
});
