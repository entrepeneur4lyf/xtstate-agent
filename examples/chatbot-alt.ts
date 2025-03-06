import { z } from 'zod';
import { createExpert } from '../src';
import { openai } from '@ai-sdk/openai';
import { getFromTerminal } from './helpers/helpers';

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

async function main() {
  let status = 'listening';
  let userMessage = '';

  while (status !== 'finished') {
    switch (status) {
      case 'listening':
        userMessage = await getFromTerminal('User:');
        status = 'responding';
        break;

      case 'responding':
        const decision = await expert.decide({
          messages: expert.getMessages(),
          goal: 'Respond to the user, unless they want to end the conversation.',
          state: {
            value: status,
            context: {
              userMessage: 'User says: ' + userMessage,
            },
          },
        });

        if (decision?.nextEvent?.type === 'expert.respond') {
          console.log(`Agent: ${decision.nextEvent.response}`);
          status = 'listening';
        } else if (decision?.nextEvent?.type === 'expert.endConversation') {
          status = 'finished';
        }
        break;
    }
  }

  console.log('End of conversation.');
  process.exit();
}

main().catch(console.error);
