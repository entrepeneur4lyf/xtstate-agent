import { openai } from '@ai-sdk/openai';
import {
  ExpertDecision,
  ExpertFeedback,
  ExpertInsight,
  ExpertMessage,
  ExpertObservation,
  createExpert,
} from '../src';
import { z } from 'zod';

const expert = createExpert({
  id: 'simple',
  model: openai('gpt-4o-mini'),
  events: {
    'expert.moveLeft': z.object({}),
    'expert.moveRight': z.object({}),
    'expert.doNothing': z.object({}),
  },
});

const db = {
  observations: [] as ExpertObservation<any>[],
  feedbackItems: [] as ExpertFeedback[],
  decisions: [] as ExpertDecision[],
  messages: [] as ExpertMessage[],
  insights: [] as ExpertInsight[],
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

  const decision = await expert.decide({
    goal: req.query.goal,
    state: observations?.state,
    observations: similarObservations,
    feedback: similarFeedback,
    insights,
    allowedEvents: ['expert.moveLeft', 'expert.moveRight'],
  });

  db.decisions.push(...expert.getDecisions());
  db.messages.push(...expert.getMessages());

  return decision;
}
