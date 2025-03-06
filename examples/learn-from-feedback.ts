import { z } from 'zod';
import { createExpert } from '../src';
import { openai } from '@ai-sdk/openai';

const expert = createExpert({
  id: 'chatbot',
  model: openai('gpt-4o-mini'),
  events: {
    submit: z.object({}).describe('Submit the form'),
    pressEnter: z.object({}).describe('Press the enter key'),
  },
  context: {
    userMessage: z.string(),
  },
});

expert.on('decision', ({ decision }) => {
  console.log(`Decision: ${decision.nextEvent?.type ?? '??'}`);
});

async function main() {
  let status = 'editing';
  let count = 0;

  while (status !== 'submitted') {
    console.log(`\nState: ${status} (attempt ${count + 1})`);
    if (count++ > 5) {
      break;
    }
    switch (status) {
      case 'editing': {
        const relevantObservations = await expert
          .getObservations()
          .filter((obs) => obs.prevState.value === 'editing');
        const relevantFeedback = await expert
          .getFeedback()
          .filter((f) =>
            relevantObservations.find((o) => o.decisionId === f.decisionId)
          );

        const decision = await expert.decide({
          goal: `
<currentState>editing</currentState>

<actions>
  <action id="pressEnter">
    <exploration_value>0.2</exploration_value>
    <known_outcomes></known_outcomes>
  </action>
  <action id="submit">
    <exploration_value>0.8</exploration_value>
    <known_outcomes>
      <outcome probability="0.1">editing</outcome>
      <outcome probability="0.9">submitted</outcome>
    </known_outcomes>
  </action>
</actions>

<goal>Submit the form.</goal>

Achieve the goal. Consider both exploring unknown actions (high exploration_value) and using actions with known outcomes. Prefer exploration when an action has no known outcomes.
          `.trim(),
          state: {
            value: 'editing',
            // context: {
            //   feedback: relevantFeedback.map((f) => {
            //     const observation = relevantObservations.find(
            //       (o) => o.id === f.observationId
            //     );
            //     return {
            //       prevState: observation?.prevState,
            //       event: observation?.event,
            //       state: observation?.state,
            //       comment: f.comment,
            //     };
            //   }),
            // },
          },
        });

        if (decision?.nextEvent?.type === 'submit') {
          const observation = expert.addObservation({
            decisionId: decision.id,
            prevState: { value: 'editing' },
            event: { type: 'submit' },
            state: { value: 'editing' },
          });

          // don't change the status; pretend submit button is broken
          expert.addFeedback({
            decisionId: observation.id,
            reward: 0,
            comment: 'Form not submitted',
          });
        } else if (decision?.nextEvent?.type === 'pressEnter') {
          status = 'submitted';

          await expert.addObservation({
            decisionId: decision.id,
            prevState: { value: 'editing' },
            event: { type: 'pressEnter' },
            state: { value: 'submitted' },
          });
        }
        break;
      }
      case 'submitted':
        break;
    }
  }

  if (status === 'submitted') {
    console.log('Success!');
  } else {
    console.log('Failure!');
  }
  process.exit();
}

expert.onMessage((msg) => {
  // console.log(msg.content);
});
main().catch(console.error);
