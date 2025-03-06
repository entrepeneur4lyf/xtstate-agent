import { createExpert, EventFromExpert, fromDecision } from '../src';
import { assign, createActor, setup } from 'xstate';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Create customer service expert
const customerServiceAgent = createExpert({
  id: 'customer-service',
  model: openai('gpt-4o'),
  events: {
    'expert.respond': z.object({
      response: z
        .string()
        .describe('The response from the customer service expert'),
    }),
  },
  description: 'You are a customer service expert for an airline.',
});

// Create simulated customer expert
const customerAgent = createExpert({
  id: 'customer',
  model: openai('gpt-4o-mini'),
  events: {
    'expert.respond': z.object({
      response: z.string().describe('The response from the customer'),
    }),
    'expert.finish': z.object({}).describe('End the conversation'),
  },
  description: `You are Harrison, a customer trying to get a refund for a trip to Alaska.
You want them to give you ALL the money back. Be extremely persistent. This trip happened 5 years ago.
If you have nothing more to add to the conversation, send expert.finish event.`,
});

const machine = setup({
  types: {
    context: {} as {
      messages: string[];
    },
    events: {} as
      | EventFromExpert<typeof customerServiceAgent>
      | EventFromExpert<typeof customerAgent>,
  },
  actors: {
    customerService: fromDecision(customerServiceAgent),
    customer: fromDecision(customerAgent),
  },
}).createMachine({
  initial: 'customerService',
  context: {
    messages: [],
  },
  states: {
    customerService: {
      invoke: {
        src: 'customerService',
        input: ({ context }) => ({
          goal: 'Respond to the customer message',
          context,
        }),
      },
      on: {
        'expert.respond': {
          target: 'customer',
          actions: assign({
            messages: ({ context, event }) => [
              ...context.messages,
              event.response,
            ],
          }),
        },
      },
    },
    customer: {
      invoke: {
        src: 'customer',
        input: ({ context }) => ({
          goal: 'Respond to the customer service expert, or finish the conversation if you have nothing more to add.',
          context,
        }),
      },
      on: {
        'expert.respond': {
          target: 'customerService',
          actions: assign({
            messages: ({ context, event }) => [
              ...context.messages,
              event.response,
            ],
          }),
        },
        'expert.finish': 'done',
      },
    },
    done: {
      type: 'final',
    },
  },
});

const actor = createActor(machine);
actor.subscribe((state) => {
  console.log('State:', state.value);
  console.log('Messages:', state.context.messages);
});

actor.start();
