import { test, expect, vi } from 'vitest';
import {
  ExpertDecision,
  ExpertFeedbackInput,
  createExpert,
  TypesFromExpert,
} from './';
import { createActor, createMachine } from 'xstate';
import { LanguageModelV1CallOptions } from 'ai';
import { z } from 'zod';
import { dummyResponseValues, MockLanguageModelV1 } from './mockModel';

test('an agent has the expected interface', () => {
  const expert = createExpert({
    id: 'test',
    events: {},
    model: new MockLanguageModelV1(),
  });

  expect(expert.decide).toBeDefined();

  expect(expert.addMessage).toBeDefined();
  expect(expert.addObservation).toBeDefined();
  expect(expert.addFeedback).toBeDefined();
  expect(expert.addDecision).toBeDefined();

  expect(expert.getMessages).toBeDefined();
  expect(expert.getObservations).toBeDefined();
  expect(expert.getFeedback).toBeDefined();
  expect(expert.getDecisions).toBeDefined();

  expect(expert.interact).toBeDefined();
});

test('expert.addMessage() adds to message history', () => {
  const model = new MockLanguageModelV1();

  const expert = createExpert({
    id: 'test',
    events: {},
    model,
  });

  expert.addMessage({
    role: 'user',
    content: [{ type: 'text', text: 'msg 1' }],
  });

  const messageHistory = expert.addMessage({
    role: 'assistant',
    content: [{ type: 'text', text: 'response 1' }],
  });

  expect(messageHistory.episodeId).toEqual(expert.episodeId);

  expect(expert.getMessages()).toContainEqual(
    expect.objectContaining({
      content: [expect.objectContaining({ text: 'msg 1' })],
    })
  );

  expect(expert.getMessages()).toContainEqual(
    expect.objectContaining({
      content: [expect.objectContaining({ text: 'response 1' })],
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('expert.addFeedback() adds to feedback', () => {
  const expert = createExpert({
    id: 'test',
    events: {
      play: z.object({
        position: z.number(),
      }),
    },
    model: {} as any,
  });

  const decision: ExpertDecision<typeof expert> = {
    goal: 'Win the game',
    decisionId: null,
    episodeId: expert.episodeId,
    goalState: { value: 'won' },
    id: 'decision-1',
    nextEvent: { type: 'play', position: 3 },
    paths: [],
    policy: 'simple',
    timestamp: Date.now(),
  };

  const obs = expert.addObservation({
    decisionId: decision.id,
    prevState: { value: 'playing' },
    event: { type: 'play', position: 3 },
    state: { value: 'lost' },
  });

  const feedback = expert.addFeedback({
    reward: 0,
    decisionId: decision.id,
  });

  expect(feedback.episodeId).toEqual(expert.episodeId);

  expect(expert.getFeedback()).toContainEqual(
    expect.objectContaining({
      reward: 0,
      decisionId: decision.id,
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('expert.addObservation() adds to observations', () => {
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const observation = expert.addObservation({
    prevState: { value: 'playing', context: {} },
    event: { type: 'play', position: 3 },
    state: { value: 'lost', context: {} },
    goal: 'Win the game',
  });

  expect(observation.episodeId).toEqual(expert.episodeId);

  expect(expert.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: { value: 'playing', context: {} },
      event: { type: 'play', position: 3 },
      state: { value: 'lost', context: {} },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('expert.addObservation() adds to observations (initial state)', () => {
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const observation = expert.addObservation({
    state: { value: 'lost' },
    goal: 'Win the game',
  });

  expect(observation.episodeId).toEqual(expert.episodeId);

  expect(expert.getObservations()).toContainEqual(
    expect.objectContaining({
      state: { value: 'lost', context: undefined },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test.skip('expert.addObservation() adds to observations with machine hash', () => {
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const machine = createMachine({
    initial: 'playing',
    states: {
      playing: {
        on: {
          play: 'lost',
        },
      },
      lost: {},
    },
  });

  const observation = expert.addObservation({
    prevState: { value: 'playing', context: {} },
    event: { type: 'play', position: 3 },
    state: { value: 'lost', context: {} },
    goal: 'Win the game',
  });

  expect(observation.episodeId).toEqual(expert.episodeId);

  expect(expert.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: { value: 'playing', context: {} },
      event: { type: 'play', position: 3 },
      state: { value: 'lost', context: {} },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('expert.addInsight() adds to insights (with observation)', () => {
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const observation = expert.addObservation({
    state: {
      value: 'playing',
    },
    goal: 'Win the game',
  });

  const insight = expert.addInsight({
    observationId: observation.id,
    attributes: {
      advantage: 50,
    },
  });

  expect(insight.episodeId).toEqual(expert.episodeId);

  expect(expert.getInsights()).toContainEqual(
    expect.objectContaining({
      attributes: { advantage: 50 },
      observationId: observation.id,
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
  expect(expert.getInsights()).toContainEqual(
    expect.objectContaining({
      attributes: { advantage: 50 },
      observationId: observation.id,
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('expert.interact() observes machine actors (no 2nd arg)', () => {
  const machine = createMachine({
    initial: 'a',
    states: {
      a: {
        on: { NEXT: 'b' },
      },
      b: {},
    },
  });

  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const actor = createActor(machine);

  expert.interact(actor);

  actor.start();

  expect(expert.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: undefined,
      state: expect.objectContaining({ value: 'a' }),
    })
  );
  expect(expert.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: undefined,
      state: expect.objectContaining({ value: 'a' }),
    })
  );

  actor.send({ type: 'NEXT' });

  expect(expert.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: expect.objectContaining({ value: 'a' }),
      event: { type: 'NEXT' },
      state: expect.objectContaining({ value: 'b' }),
    })
  );
});

test('You can listen for feedback events', () => {
  const fn = vi.fn();
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  expert.onFeedback(fn);

  expert.addFeedback({
    reward: 1,
    decisionId: 'dec-1',
    comment: 'Good move',
    attributes: { confidence: 'high' },
  });

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      reward: 1,
      decisionId: 'dec-1',
      comment: 'Good move',
      attributes: { confidence: 'high' },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('You can listen for decision events', async () => {
  const fn = vi.fn();
  const model = new MockLanguageModelV1({
    doGenerate: async (params: LanguageModelV1CallOptions) => {
      const keys =
        params.mode.type === 'regular'
          ? params.mode.tools?.map((tool) => tool.name)
          : [];

      return {
        ...dummyResponseValues,
        finishReason: 'tool-calls',
        toolCalls: [
          {
            toolCallType: 'function',
            toolCallId: 'call-1',
            toolName: keys![0],
            args: `{ "type": "${keys?.[0]}" }`,
          },
        ],
      } as any;
    },
  });

  const expert = createExpert({
    id: 'test',
    model,
    events: {
      WIN: z.object({}),
    },
  });

  expert.on('decision', fn);

  await expert.decide({
    goal: 'Win the game',
    state: {
      value: 'playing',
      context: {},
    },
    machine: createMachine({
      initial: 'playing',
      states: {
        playing: {
          on: {
            WIN: {
              target: 'won',
            },
          },
        },
        won: {},
      },
    }),
  });

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      decision: expect.objectContaining({
        nextEvent: {
          type: 'WIN',
        },
      }),
    })
  );
});

test('expert.types provides context and event types', () => {
  const expert = createExpert({
    model: {} as any,
    events: {
      setScore: z.object({
        score: z.number(),
      }),
    },
    context: {
      score: z.number(),
    },
  });

  let types = {} as TypesFromExpert<typeof expert>;

  types satisfies { context: any; events: any };

  types.context satisfies { score: number };

  // @ts-expect-error
  types.context satisfies { score: string };
});

test('It allows unrecognized events', () => {
  const expert = createExpert({
    model: {} as any,
    events: {},
    context: {},
  });

  expect(() => {
    expert.send({
      // @ts-expect-error
      type: 'unrecognized',
    });
  }).not.toThrow();
});

test('You can listen for message events', () => {
  const fn = vi.fn();
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  expert.onMessage(fn);

  const message = {
    role: 'user' as const,
    content: [{ type: 'text' as const, text: 'test message' }],
  };

  expert.addMessage(message);

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      role: 'user',
      content: [{ type: 'text', text: 'test message' }],
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('expert.getDecisions() returns decisions from context', () => {
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
    policy: async (expert) => {
      return {
        id: Date.now().toString(),
        decisionId: null,
        episodeId: expert.episodeId,
        policy: 'test-policy',
        goal: '',
        goalState: null,
        paths: [
          {
            state: null,
            steps: [],
          },
        ],
        nextEvent: null,
        timestamp: Date.now(),
      };
    },
  });

  const decisions = expert.getDecisions();

  expect(decisions).toBeDefined();
  expect(Array.isArray(decisions)).toBe(true);
});

test('Event listeners can be unsubscribed', () => {
  const fn = vi.fn();
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const subscription = expert.on('message', fn);

  expert.addMessage({
    role: 'user',
    content: [{ type: 'text', text: 'first message' }],
  });

  expect(fn).toHaveBeenCalledTimes(1);

  subscription.unsubscribe();

  expert.addMessage({
    role: 'user',
    content: [{ type: 'text', text: 'second message' }],
  });

  expect(fn).toHaveBeenCalledTimes(1); // Still only called once
});

test('expert.observe() adds observations from actor snapshots', () => {
  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: { START: 'running' },
      },
      running: {},
    },
  });

  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const actor = createActor(machine);
  const subscription = expert.observe(actor);

  actor.start();
  actor.send({ type: 'START' });

  expect(expert.getObservations()).toContainEqual(
    expect.objectContaining({
      state: expect.objectContaining({ value: 'idle' }),
    })
  );

  expect(expert.getObservations()).toContainEqual(
    expect.objectContaining({
      prevState: expect.objectContaining({ value: 'idle' }),
      event: { type: 'START' },
      state: expect.objectContaining({ value: 'running' }),
    })
  );

  subscription.unsubscribe();
});

test('expert.addObservation() accepts custom episodeId', () => {
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const customEpisodeId = 'custom-episode-123';
  const observation = expert.addObservation({
    state: { value: 'playing' },
    goal: 'Win the game',
    episodeId: customEpisodeId,
  });

  expect(observation.episodeId).toEqual(customEpisodeId);
  expect(expert.getObservations()).toContainEqual(
    expect.objectContaining({
      episodeId: customEpisodeId,
    })
  );
});

test('expert.addFeedback() accepts custom episodeId', () => {
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const customEpisodeId = 'custom-episode-123';
  const feedback = expert.addFeedback({
    reward: 1,
    decisionId: 'dec-1',
    episodeId: customEpisodeId,
  });

  expect(feedback.episodeId).toEqual(customEpisodeId);
  expect(expert.getFeedback()).toContainEqual(
    expect.objectContaining({
      episodeId: customEpisodeId,
    })
  );
});

test('expert.addObservation() accepts decisionId', () => {
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const decisionId = 'decision-123';
  const observation = expert.addObservation({
    state: { value: 'playing' },
    goal: 'Win the game',
    decisionId,
  });

  expect(observation.decisionId).toEqual(decisionId);
  expect(expert.getObservations()).toContainEqual(
    expect.objectContaining({
      decisionId,
    })
  );
});

test('expert.addFeedback() accepts decisionId', () => {
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const decisionId = 'decision-123';
  const feedback = expert.addFeedback({
    reward: 1,
    decisionId,
  });

  expect(feedback.decisionId).toEqual(decisionId);
  expect(expert.getFeedback()).toContainEqual(
    expect.objectContaining({
      decisionId,
    })
  );
});

test('You can listen for observation events', () => {
  const fn = vi.fn();
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  expert.onObservation(fn);

  expert.addObservation({
    state: { value: 'playing' },
    goal: 'Win the game',
  });

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      state: { value: 'playing' },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('You can listen for decision events', () => {
  const fn = vi.fn();
  const expert = createExpert({
    id: 'test',
    events: {
      MOVE: z.object({}),
    },
    model: {} as any,
  });

  expert.onDecision(fn);

  const decision = {
    id: 'decision-1',
    decisionId: null,
    episodeId: expert.episodeId,
    policy: 'test-policy',
    goal: 'Win the game',
    goalState: { value: 'won' },
    paths: [],
    nextEvent: { type: 'MOVE' },
    timestamp: Date.now(),
  } satisfies ExpertDecision<typeof expert>;

  expert.addDecision(decision);

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'decision-1',
      episodeId: expert.episodeId,
      policy: 'test-policy',
      goal: 'Win the game',
      nextEvent: { type: 'MOVE' },
    })
  );
});

test('Event listeners can be unsubscribed (onObservation)', () => {
  const fn = vi.fn();
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const subscription = expert.onObservation(fn);

  expert.addObservation({
    state: { value: 'playing' },
    goal: 'Win the game',
  });

  expect(fn).toHaveBeenCalledTimes(1);

  subscription.unsubscribe();

  expert.addObservation({
    state: { value: 'playing' },
    goal: 'Win the game again',
  });

  expect(fn).toHaveBeenCalledTimes(1); // Still only called once
});

test('Event listeners can be unsubscribed (onDecision)', () => {
  const fn = vi.fn();
  const expert = createExpert({
    id: 'test',
    events: {
      MOVE: z.object({}),
    },
    model: {} as any,
  });

  const subscription = expert.onDecision(fn);

  const decision = {
    id: 'decision-1',
    decisionId: null,
    episodeId: expert.episodeId,
    policy: 'test-policy',
    goal: 'Win the game',
    goalState: { value: 'won' },
    paths: [],
    nextEvent: { type: 'MOVE' },
    timestamp: Date.now(),
  } satisfies ExpertDecision<typeof expert>;

  expert.addDecision(decision);

  expect(fn).toHaveBeenCalledTimes(1);

  subscription.unsubscribe();

  expert.addDecision({
    ...decision,
    id: 'decision-2',
  });

  expect(fn).toHaveBeenCalledTimes(1); // Still only called once
});

test('Event listeners can be unsubscribed (onFeedback)', () => {
  const fn = vi.fn();
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  const subscription = expert.onFeedback(fn);

  expert.addFeedback({
    reward: 1,
    decisionId: 'dec-1',
  });

  expect(fn).toHaveBeenCalledTimes(1);

  subscription.unsubscribe();

  expert.addFeedback({
    reward: 0,
    decisionId: 'dec-2',
  });

  expect(fn).toHaveBeenCalledTimes(1); // Still only called once
});

test('Feedback events include optional fields', () => {
  const fn = vi.fn();
  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
  });

  expert.onFeedback(fn);

  // Test with minimal feedback
  expert.addFeedback({
    reward: 1,
    decisionId: 'dec-1',
  });

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      reward: 1,
      decisionId: 'dec-1',
      comment: undefined,
      attributes: {},
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );

  // Test with all optional fields
  expert.addFeedback({
    reward: 0,
    decisionId: 'dec-2',
    comment: 'Could be better',
    attributes: { reason: 'suboptimal' },
  } satisfies ExpertFeedbackInput);

  expect(fn).toHaveBeenLastCalledWith(
    expect.objectContaining({
      reward: 0,
      decisionId: 'dec-2',
      comment: 'Could be better',
      attributes: { reason: 'suboptimal' },
      episodeId: expect.any(String),
      timestamp: expect.any(Number),
    })
  );
});

test('Feedback events maintain episodeId consistency', () => {
  const fn = vi.fn();
  const customEpisodeId = 'custom-episode-123';

  const expert = createExpert({
    id: 'test',
    events: {},
    model: {} as any,
    episodeId: customEpisodeId,
  });

  expert.onFeedback(fn);

  expert.addFeedback({
    reward: 1,
    decisionId: 'dec-1',
  });

  expect(fn).toHaveBeenCalledWith(
    expect.objectContaining({
      episodeId: customEpisodeId,
    })
  );

  // Test with explicit different episodeId
  const differentEpisodeId = 'different-episode-456';
  expert.addFeedback({
    reward: 0,
    decisionId: 'dec-2',
    episodeId: differentEpisodeId,
  });

  expect(fn).toHaveBeenLastCalledWith(
    expect.objectContaining({
      episodeId: differentEpisodeId,
    })
  );
});
