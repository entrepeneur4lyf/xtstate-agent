import { openai } from '@ai-sdk/openai';
import {
  AgentDecision,
  AgentFeedback,
  AgentInsight,
  AgentMessage,
  AgentObservation,
  createAgent,
} from '../src';
import { z } from 'zod';

const agent = createAgent({
  id: 'simple',
  model: openai('gpt-4o-mini'),
  events: {
    'agent.moveLeft': z.object({}),
    'agent.moveRight': z.object({}),
    'agent.doNothing': z.object({}),
  },
});

const db = {
  observations: [] as AgentObservation<any>[],
  feedbackItems: [] as AgentFeedback[],
  decisions: [] as AgentDecision[],
  messages: [] as AgentMessage[],
  insights: [] as AgentInsight[],
};

// async function postObservation(req: unknown) {
//   db.observations.push(req.body);
// }

async function getDecision(req: {
  query: {
    episodeId: string;
    goal: string;
  };
}) {
  // Get relevant observations
  const observations = db.observations
    .filter((obs) => obs.episodeId === req.query.episodeId)
    .at(-1);
  const similarObservations = db.observations.filter(
    (obs) => obs.prevState?.value === observations?.prevState?.value
  );

  // Get relevant feedback
  const similarFeedback = db.feedbackItems.filter((fb) => {
    similarObservations.map((obs) => obs.decisionId).includes(fb.decisionId);
  });

  // Get relevant insights
  const insights = db.insights.filter((insight) =>
    similarObservations.map((obs) => obs.id).includes(insight.observationId)
  );

  const decision = await agent.decide({
    goal: req.query.goal,
    state: observations?.state,
    observations: similarObservations,
    feedback: similarFeedback,
    insights,
    allowedEvents: ['agent.moveLeft', 'agent.moveRight'],
  });

  db.decisions.push(...agent.getDecisions());
  db.messages.push(...agent.getMessages());

  return decision;
}
