import { CoreToolResult, generateText } from 'ai';
import {
  AgentDecision,
  AgentDecideInput,
  PromptTemplate,
  AnyAgent,
} from '../types';
import { convertToXml, randomId } from '../utils';
import { transition } from 'xstate';
import { combinePromptAndMessages } from '../text';
import { getToolMap } from '../decide';

const toolPolicyPromptTemplate: PromptTemplate<any> = (data) => {
  return `
${convertToXml(data)}

Make at most one tool call to achieve the above goal. If the goal cannot be achieved with any tool calls, do not make any tool call.
  `.trim();
};

export async function toolPolicy<TAgent extends AnyAgent>(
  agent: TAgent,
  input: AgentDecideInput<TAgent>
): Promise<AgentDecision<TAgent> | undefined> {
  const toolMap = getToolMap(agent, input);

  if (!toolMap) {
    // No valid transitions for the specified tools
    return undefined;
  }

  // Create a prompt with the given context and goal.
  // The template is used to ensure that a single tool call at most is made.
  const prompt = toolPolicyPromptTemplate({
    stateValue: input.state.value,
    context: input.context ?? input.state.context,
    goal: input.goal,
  });

  const messages = combinePromptAndMessages(prompt, input.messages);

  const model = input.model ? agent.wrap(input.model) : agent.model;

  const { state, machine, events, goal, model: _, ...rest } = input;

  const machineState =
    input.machine && input.state
      ? input.machine.resolveState({
          ...input.state,
          context: input.state.context ?? {},
        })
      : undefined;

  const result = await generateText({
    ...rest,
    system: input.system ?? agent.description,
    model,
    messages,
    tools: toolMap,
    toolChoice: input.toolChoice ?? 'required',
  });

  result.response.messages.forEach((m) => {
    agent.addMessage(m);
  });

  const singleResult = result.toolResults[0] as unknown as CoreToolResult<
    any,
    any,
    any
  >;

  if (!singleResult) {
    // TODO: retries?
    console.warn('No tool call results returned');
    return undefined;
  }

  const nextEvent = singleResult.result;

  return {
    id: randomId(),
    decisionId: input.decisionId ?? null,
    policy: 'simple',
    goal: input.goal,
    goalState: input.state,
    nextEvent,
    episodeId: input.episodeId ?? agent.episodeId,
    timestamp: Date.now(),
    paths: [
      {
        state: null,
        steps: [
          {
            event: nextEvent,
            state:
              machine && machineState
                ? transition(machine, machineState, nextEvent)[0]
                : null,
          },
        ],
      },
    ],
  };
}
