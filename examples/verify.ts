import { assign, createActor, setup, log } from 'xstate';
import { fromTerminal } from './helpers/helpers';
import { createExpert, EventFromExpert, fromDecision } from '../src';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

const expert = createExpert({
  id: 'verifier',
  model: openai('gpt-3.5-turbo-16k-0613'),
  events: {
    'expert.validateAnswer': z.object({
      isValid: z.boolean(),
      feedback: z.string(),
    }),
    'expert.answerQuestion': z.object({
      answer: z.string().describe('The answer from the expert'),
    }),
    'expert.validateQuestion': z.object({
      isValid: z
        .boolean()
        .describe(
          'Whether the question is a valid question; that is, is it possible to even answer this question in a verifiably correct way?'
        ),
      explanation: z
        .string()
        .describe('An explanation for why the question is or is not valid'),
    }),
  },
});

const machine = setup({
  types: {
    context: {} as {
      question: string | null;
      answer: string | null;
      validation: string | null;
    },
    events: {} as EventFromExpert<typeof expert>,
  },
  actors: {
    getFromTerminal: fromTerminal,
    expert: fromDecision(expert),
  },
}).createMachine({
  initial: 'askQuestion',
  context: { question: null, answer: null, validation: null },
  states: {
    askQuestion: {
      invoke: {
        src: 'getFromTerminal',
        input: 'Ask a (potentially silly) question',
        onDone: {
          actions: assign({
            question: ({ event }) => event.output,
          }),
          target: 'validateQuestion',
        },
      },
    },
    validateQuestion: {
      invoke: {
        src: 'expert',
        input: ({ context }) => ({
          goal: `Validate this question: ${context.question!}`,
        }),
      },
      on: {
        'expert.validateQuestion': [
          {
            target: 'askQuestion',
            guard: ({ event }) => !event.isValid,
            actions: log(({ event }) => event.explanation),
          },
          {
            target: 'answerQuestion',
          },
        ],
      },
    },
    answerQuestion: {
      invoke: {
        src: 'expert',
        input: ({ context }) => ({
          goal: `Answer this question: ${context.question}`,
        }),
      },
      on: {
        'expert.answerQuestion': {
          actions: assign({
            answer: ({ event }) => event.answer,
          }),
          target: 'validateAnswer',
        },
      },
    },
    validateAnswer: {
      invoke: {
        src: 'expert',
        input: ({ context }) => ({
          goal: `Validate if this is a good answer to the question: ${context.question}\nAnswer provided: ${context.answer}`,
        }),
      },
      on: {
        'expert.validateAnswer': {
          actions: assign({
            validation: ({ event }) => event.feedback,
          }),
        },
      },
    },
  },
});

const actor = createActor(machine, {});

actor.subscribe((s) => {
  console.log(s.value, s.context);
});

actor.start();
