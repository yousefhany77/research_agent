import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { BaseChatModel } from 'langchain/chat_models/base';
import { loadEvaluator } from 'langchain/evaluation';
import { ChatPromptTemplate, MessagesPlaceholder } from 'langchain/prompts';
import { DynamicStructuredTool, DynamicTool } from 'langchain/tools';
import NotificationManager, { Notification, NotificationActor } from '~/lib/notification/NotificationManager.js';
import createOpenAIChatModel from '~/utils/createOpenAIChatModel.js';
import { QuestionGeneratorAgent } from '../QuestionGenerator/QuestionGenerator.js';
import { SearchWorker } from '../SearchWorker/SearchWorker.js';

const researchManagerSystemPrompt = `You are a research manager. you have been asked to do "{query}". You need to find the best information and finish the task. You have workers that helps you in your task and these are there results from there research: results \n{results}. \nYou need to use these information to write a detailed report on the topic in markdown format. and follow the instructions: {instructions}
`;

/**
 * @description ResearchManager is an agent that manages the research process.
 * It uses a QuestionGeneratorAgent to generate questions and a SearchWorker to perform searches.
 * It then uses an LLM to generate a report based on the search results.
 *
 * @param llmModel The OpenAI chat model used by the ResearchManager.
 * @param questionGenerator The QuestionGeneratorAgent used by the ResearchManager. @see {@link QuestionGeneratorAgent}
 */
export class ResearchManager {
  private readonly searchWorkersToolsResults: Record<string, string> = {};
  private readonly researchManagerTools: (DynamicStructuredTool | DynamicTool)[] = [];

  constructor(
    private readonly llmModel: BaseChatModel = createOpenAIChatModel(),
    private readonly questionGenerator = new QuestionGeneratorAgent(),
    private readonly config: {
      maxIterations: number;
      researchManagerTools?: (DynamicStructuredTool | DynamicTool)[];
      researchWorkerConfig?: {
        llmModel?: ChatOpenAI;
        tools?: ConstructorParameters<typeof SearchWorker>[2];
      };
    } = {
      maxIterations: 2,
    }
  ) {
    this.notify({
      message: 'ResearchManager has been initialized',
      type: `${NotificationActor.ResearchManager}:initialized`,
    });
    this.researchManagerTools = config.researchManagerTools ?? [];
  }

  /**
   * Search until we get a valid result for the given query
   * @param query
   */
  private searchUntilValidResult = async (query: string): Promise<string> => {
    // keep iterating until we get a valid result
    let result = '';
    let validateQueryResult: {
      valid: boolean;
      reason?: string;
    } = {
      valid: false,
      reason: undefined,
    };
    this.notify({
      message: `ResearchManager is searching for "${query}"`,
      type: `${NotificationActor.ResearchManager}:Task:Start`,
      payload: { query },
    });
    for (let i = 0; i < this.config.maxIterations; i++) {
      const searchWorker = new SearchWorker(
        this.config?.researchWorkerConfig?.llmModel,
        this.searchWorkersToolsResults,
        this.config?.researchWorkerConfig?.tools
      );
      result = await searchWorker.search(
        i === 0
          ? query
          : `
        I Asked for "${query}" but the result was invalid.
        And the reason was "${validateQueryResult.reason}"
        So Again I'm asking for "${query}
        `
      );
      this.notify({
        message: `ResearchManager has received the result for "${query}" but it was invalid. The reason was "${validateQueryResult.reason}", so the ${searchWorker.workerName} will search again.`,
        type: `${NotificationActor.ResearchManager}:Task:Error`,
      });
      validateQueryResult = await this.validateSearchResult(query, result);
      if (validateQueryResult.valid) {
        this.notify({
          message: `ResearchManager has approved the result for "${query}" from ${searchWorker.workerName}`,
          type: `${NotificationActor.ResearchManager}:Task:End`,
        });
        break;
      }
    }
    if (!validateQueryResult.valid) {
      this.notify({
        message: `ResearchManager couldn't find a valid result for "${query}" after ${this.config.maxIterations} iterations. The reason was "${validateQueryResult.reason}"`,
        type: `${NotificationActor.ResearchManager}:Task:Error`,
      });
      result = `I'm sorry, I couldn't find a valid result for "${query}" after ${this.config.maxIterations} iterations. The reason was "${validateQueryResult.reason}" Try again with more context or a different question.`;
    }
    return result;
  };

  /**
   * Performs a search operation using the specified query.
   * @param query The search query.
   * @returns A promise that resolves to the search result as a string.
   */
  public async search(query: string, instructions?: string): Promise<string> {
    this.notify({
      message: `ResearchManager has been asked to search for "${query}"`,
      type: `${NotificationActor.ResearchManager}:Task:Start`,
    });
    const { questions } = await this.questionGenerator.generateQuestions(query);
    const promises = questions.map((q) => this.searchUntilValidResult(q));
    const results = await Promise.all(promises);

    let report: string;
    if (this.researchManagerTools.length > 0) {
      const runnableAgent = await createOpenAIToolsAgent({
        llm: this.llmModel,
        tools: this.researchManagerTools,
        prompt: ChatPromptTemplate.fromMessages([
          ['system', researchManagerSystemPrompt],
          new MessagesPlaceholder('agent_scratchpad'),
          ['human', '{query}'],
        ]),
      });
      const chain = new AgentExecutor({
        agent: runnableAgent,
        tools: this.researchManagerTools,
      });
      const agentResults = (await chain.invoke(
        {
          query,
          results: results.join('\n'),
          instructions,
        },
        {
          runName: 'ResearchManager',
        }
      )) as { input: string; output: string };
      report = agentResults.output;
    } else {
      const researchManagerPrompt = ChatPromptTemplate.fromMessages([
        ['system', researchManagerSystemPrompt],
        ['human', '{query}'],
      ]);
      const chain = researchManagerPrompt.pipe(this.llmModel).pipe(new StringOutputParser());
      report = await chain.invoke(
        {
          query,
          results: results.join('\n'),
          instructions,
        },
        {
          runName: 'ResearchManager',
        }
      );
    }

    this.notify({
      message: `ResearchManager has finished searching for "${query}"`,
      type: `${NotificationActor.ResearchManager}:Task:End`,
      payload: { query, results, report },
    });
    return report;
  }

  /**
   * Validates the search result for the given query. The result is considered valid if it answers the question and is relevant to the query.
   * @param query The search query.
   * @param result The search result.
   * @returns A promise that resolves to an object containing the result of the validation.
   */
  private async validateSearchResult(
    query: string,
    result: string
  ): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const customCriterion = {
      numeric: `Does the results for "${query}" answer the question and relevant?`,
    };

    const evaluator = await loadEvaluator('criteria', {
      criteria: customCriterion,
      llm: this.llmModel,
    });

    const res = (await evaluator.evaluateStrings({
      input: query,
      prediction: result,
    })) as {
      reasoning: string;
      value: 'Y' | 'N';
      score: number;
    };

    return {
      valid: res.value === 'Y',
      reason: res.reasoning,
    };
  }

  private notify({ message, type, payload }: Pick<Notification, 'message' | 'type' | 'payload'>): void {
    return NotificationManager.notify({
      actor: NotificationActor.ResearchManager,
      createdAt: new Date(),
      createdBy: 'ResearchManager',
      message,
      type,
      payload,
    });
  }
}
