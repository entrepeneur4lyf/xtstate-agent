import { z } from 'zod';
import { createExpert, fromDecision, TypesFromExpert } from '../src';
import { openai } from '@ai-sdk/openai';
import { assign, createActor, log, setup } from 'xstate';
import { fromTerminal, getFromTerminal } from './helpers/helpers';

const expert = createExpert({
  id: 'chatbot',
  model: openai('gpt-4o-mini'),
  events: {
    'expert.respond': z.object({
      response: z.string().describe('The response from the expert'),
    }),
    'expert.endConversation': z.object({}).describe('Stop the conversation'),
  },
  context: {
    userMessage: z.string(),
  },
});

const machine = setup({
  types: {} as TypesFromExpert<typeof expert>,
  actors: { getFromTerminal: fromTerminal },
}).createMachine({
  initial: 'listening',
  context: {
    userMessage: '',
  },
  states: {
    listening: {
      invoke: {
        src: 'getFromTerminal',
        input: 'User:',
        onDone: {
          actions: assign({
            userMessage: ({ event }) => event.output,
          }),
          target: 'responding',
        },
      },
    },
    responding: {
      on: {
        'expert.respond': {
          actions: log(({ event }) => `Agent: ${event.response}`),
          target: 'listening',
        },
        'expert.endConversation': 'finished',
      },
    },
    finished: {
      type: 'final',
    },
  },
  exit: () => {
    console.log('End of conversation.');
    process.exit();
  },
});

const actor = createActor(machine).start();

expert.interact(actor, (s) => {
  if (s.state.matches('responding')) {
    return {
      goal: 'Respond to the user, unless they want to end the conversation.',
      messages: expert.getMessages(),
    };
  }
});
