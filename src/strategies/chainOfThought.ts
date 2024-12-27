import { generateText } from 'ai';
import {
  AnyAgent,
  AgentDecideInput,
  AgentDecision,
  PromptTemplate,
} from '../types';
import { resolveMessages } from '../text';
import { toolStrategy } from './toolStrategy';
import { convertToXml } from '../utils';

const chainOfThoughtPromptTemplate: PromptTemplate<any> = ({
  stateValue,
  context,
  goal,
}) => {
  return `${convertToXml({ stateValue, context, goal })}

How would you achieve the goal? Think step-by-step.`;
};

export async function chainOfThoughtStrategy<T extends AnyAgent>(
  agent: T,
  input: AgentDecideInput<any>
): Promise<AgentDecision<any> | undefined> {
  const prompt = chainOfThoughtPromptTemplate({
    stateValue: input.state.value,
    context: input.context ?? input.state.context,
    goal: input.goal,
  });

  const messages = resolveMessages(prompt, input.messages);

  const model = input.model ? agent.wrap(input.model) : agent.model;

  const result = await generateText({
    model,
    system: input.system ?? agent.description,
    messages,
  });

  const decision = await toolStrategy(agent, {
    ...input,
    messages: messages.concat(result.response.messages),
  });

  return decision;
}
