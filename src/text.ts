import {
  generateText,
  streamText,
  type CoreMessage,
  type CoreTool,
  type GenerateTextResult,
} from 'ai';
import {
  ExpertGenerateTextOptions,
  ExpertStreamTextOptions,
  AnyExpert,
} from './types';
import { defaultTextTemplate } from './templates/defaultText';
import {
  ObservableActorLogic,
  Observer,
  PromiseActorLogic,
  fromObservable,
  fromPromise,
  toObserver,
} from 'xstate';

/**
 * Gets an array of messages from the given prompt, based on the agent and options.
 *
 * @param agent
 * @param prompt
 * @param options
 * @returns
 */
export function combinePromptAndMessages(
  prompt: string,
  messages?: CoreMessage[]
): CoreMessage[] {
  return (messages ?? []).concat({
    role: 'user',
    content: prompt,
  });
}

export function fromTextStream<TExpert extends AnyExpert>(
  expert: TExpert,
  options?: ExpertStreamTextOptions
): ObservableActorLogic<
  { textDelta: string },
  Omit<ExpertStreamTextOptions, 'context'> & {
    context?: Record<string, any>;
  }
> {
  const template = options?.template ?? defaultTextTemplate;
  return fromObservable(({ input }) => {
    const observers = new Set<Observer<{ textDelta: string }>>();

    // TODO: check if messages was provided instead

    (async () => {
      const model = input.model ? expert.wrap(input.model) : expert.model;
      const goal =
        typeof input.prompt === 'string'
          ? input.prompt
          : await input.prompt(expert);
      const promptWithContext = template({
        goal,
        context: input.context,
      });
      const messages = combinePromptAndMessages(
        promptWithContext,
        input.messages
      );
      const result = await streamText({
        ...options,
        ...input,
        prompt: undefined, // overwritten by messages
        model,
        messages,
      });

      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          observers.forEach((observer) => {
            observer.next?.(part);
          });
        }
      }
    })();

    return {
      subscribe: (...args: any[]) => {
        const observer = toObserver(...args);
        observers.add(observer);

        return {
          unsubscribe: () => {
            observers.delete(observer);
          },
        };
      },
    };
  });
}

export function fromText<TExpert extends AnyExpert>(
  expert: TExpert,
  options?: ExpertGenerateTextOptions
): PromiseActorLogic<
  GenerateTextResult<Record<string, CoreTool<any, any>>, any>,
  Omit<ExpertGenerateTextOptions, 'context'> & {
    context?: Record<string, any>;
  }
> {
  const resolvedOptions = {
    ...options,
  };

  const template = resolvedOptions.template ?? defaultTextTemplate;

  return fromPromise(async ({ input }) => {
    const goal =
      typeof input.prompt === 'string'
        ? input.prompt
        : await input.prompt(expert);

    const promptWithContext = template({
      goal,
      context: input.context,
    });

    const messages = combinePromptAndMessages(
      promptWithContext,
      input.messages
    );

    const model = input.model ? expert.wrap(input.model) : expert.model;

    return await generateText({
      ...input,
      ...options,
      prompt: undefined,
      messages,
      model,
    });
  });
}
