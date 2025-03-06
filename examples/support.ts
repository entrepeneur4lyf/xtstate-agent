import { openai } from '@ai-sdk/openai';
import { createExpert, EventFromExpert, fromDecision } from '../src';
import { z } from 'zod';
import { createActor, log, setup } from 'xstate';

const expert = createExpert({
  id: 'support-expert',
  model: openai('gpt-4o-mini'),
  events: {
    'expert.respond': z.object({
      response: z.string().describe('The response from the expert'),
    }),
    'expert.frontline.classify': z.object({
      category: z
        .enum(['billing', 'technical', 'other'])
        .describe('The category of the customer issue'),
    }),
    'expert.refund': z
      .object({
        response: z.string().describe('The response from the expert'),
      })
      .describe('The expert wants to refund the user'),
    'expert.technical.solve': z.object({
      solution: z
        .string()
        .describe('The solution provided by the technical expert'),
    }),
    'expert.endConversation': z
      .object({
        response: z.string().describe('The response from the expert'),
      })
      .describe('The expert ends the conversation'),
  },
});

const machine = setup({
  types: {
    events: {} as EventFromExpert<typeof expert>,
    input: {} as string,
    context: {} as {
      customerIssue: string;
    },
  },
  actors: { expert: fromDecision(expert) },
}).createMachine({
  initial: 'frontline',
  context: ({ input }) => ({
    customerIssue: input,
  }),
  states: {
    frontline: {
      on: {
        'expert.frontline.classify': [
          {
            actions: log(({ event }) => event),
            guard: ({ event }) => event.category === 'billing',
            target: 'billing',
          },
          {
            actions: log(({ event }) => event),
            guard: ({ event }) => event.category === 'technical',
            target: 'technical',
          },
          {
            actions: log(({ event }) => event),
            target: 'conversational',
          },
        ],
      },
    },
    billing: {
      on: {
        'expert.refund': {
          actions: log(({ event }) => event),
          target: 'refund',
        },
      },
    },
    technical: {
      on: {
        'expert.technical.solve': {
          actions: log(({ event }) => event),
          target: 'conversational',
        },
      },
    },
    conversational: {
      on: {
        'expert.endConversation': {
          actions: log(({ event }) => event),
          target: 'end',
        },
      },
    },
    refund: {
      entry: () => console.log('Refunding...'),
      after: {
        1000: { target: 'conversational' },
      },
    },
    end: {
      type: 'final',
    },
  },
});

const actor = createActor(machine, {
  input: `I've changed my mind and I want a refund for order #182818!`,
});

actor.start();

expert.interact(actor, ({ state }) => {
  if (state.matches('frontline')) {
    return {
      goal: `The previous conversation is an interaction between a customer support representative and a user.
      Classify whether the representative is routing the user to a billing or technical team, or whether they are just responding conversationally.`,
      system: `You are frontline support staff for LangCorp, a company that sells computers.
      Be concise in your responses.
      You can chat with customers and help them with basic questions, but if the customer is having a billing or technical problem,
      do not try to answer the question directly or gather information.
      Instead, immediately transfer them to the billing or technical team by asking the user to hold for a moment.
      Otherwise, just respond conversationally.`,
    };
  }

  if (state.matches('billing')) {
    return {
      goal: `The following text is a response from a customer support representative. Extract whether they want to refund the user or not.`,
      system: `Your job is to detect whether a billing support representative wants to refund the user.`,
    };
  }

  if (state.matches('technical')) {
    return {
      goal: 'Solve the customer issue.',
      system: `You are an expert at diagnosing technical computer issues. You work for a company called LangCorp that sells computers. Help the user to the best of your ability, but be concise in your responses.`,
    };
  }

  if (state.matches('conversational')) {
    return {
      goal: 'You are a customer support expert that is ending the conversation with the customer. Respond politely and thank them for their time.',
      system: `You are a customer support expert that is ending the conversation with the customer. Respond politely and thank them for their time.`,
    };
  }
});
