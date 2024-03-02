import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { AgentExecutor, AgentStep } from 'langchain/agents';
import { formatToOpenAIFunctionMessages } from 'langchain/agents/format_scratchpad';
import { OpenAIFunctionsAgentOutputParser } from 'langchain/agents/openai/output_parser';
import { loadEvaluator } from 'langchain/evaluation';
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from 'langchain/prompts';
import { RunnableSequence } from 'langchain/runnables';
import { DynamicTool } from 'langchain/tools';
import createOpenAIChatModel from '~/utils/createOpenAIChatModel.js';
import { QuestionGeneratorAgent } from '../QuestionGenerator/QuestionGenerator.js';
import { SearchWorker } from '../SearchWorker/SearchWorker.js';

const researchManagerPrompt = new ChatPromptTemplate({
  promptMessages: [
    SystemMessagePromptTemplate.fromTemplate(`You are a research manager. you have been asked to do "{query}". You need to find the best information and finish the task. You have workers that helps you in your task and these are there results from there research: results \n{results}. \nYou need to use these information to write a detailed report on the topic in markdown format
`),
    new MessagesPlaceholder('agent_scratchpad'),
  ],
  inputVariables: ['query', 'results', 'agent_scratchpad'],
});

const researchWorkerAsTool = new DynamicTool({
  name: 'Research_Worker',
  description:
    'This tool is a research worker that helps the research manager to find the best information and finish the task. it can search the web or visit websites and use the information to write a detailed report on the topic in markdown format.',
  func: async (input: string): Promise<string> => {
    console.log(`Using ResearchWorker Tool to search for "${input}"`);
    const worker = new SearchWorker();
    const results = await worker.search(input);
    return results;
  },
});

const researchManagerTools = [researchWorkerAsTool];

/**
 * @description ResearchManager is an agent that manages the research process.
 * It uses a QuestionGeneratorAgent to generate questions and a SearchWorker to perform searches.
 * It then uses an LLM to generate a report based on the search results.
 *
 * @param llmModel The OpenAI chat model used by the ResearchManager.
 * @param questionGenerator The QuestionGeneratorAgent used by the ResearchManager. @see {@link QuestionGeneratorAgent}
 */
export class ResearchManager {
  constructor(
    private readonly llmModel = createOpenAIChatModel({
      maxTokens: 4000,
    }),
    private readonly questionGenerator = new QuestionGeneratorAgent(),
    private readonly searchWorker = new SearchWorker(),
    private readonly config = {
      maxIterations: 2,
    }
  ) {}

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
    for (let i = 0; i < this.config.maxIterations; i++) {
      result = await this.searchWorker.search(
        i === 0
          ? query
          : `
        I Asked for "${query}" but the result was "${result}"
        And the reason was "${validateQueryResult.reason}"
        So Again I'm asking for "${query}
        `
      );
      validateQueryResult = await this.validateSearchResult(query, result);
      if (validateQueryResult.valid) {
        break;
      }
    }
    if (!validateQueryResult.valid) {
      result = `I'm sorry, I couldn't find a valid result for "${query}" after ${this.config.maxIterations} iterations. The reason was "${validateQueryResult.reason}" Try again with more context or a different question.`;
    }
    return result;
  };

  /**
   * Performs a search operation using the specified query.
   * @param query The search query.
   * @returns A promise that resolves to the search result as a string.
   */
  public async search(query: string): Promise<string> {
    const { questions } = await this.questionGenerator.generateQuestions(query);
    const promises = questions.map((q) => this.searchUntilValidResult(q));
    const results = await Promise.all(promises);
    const modelWithFunctions = this.llmModel.bind({
      functions: researchManagerTools.map((tool) => convertToOpenAIFunction(tool)),
    });

    console.log(`ResearchManager: Searching for "${query}"`);
    const runnableAgent = RunnableSequence.from([
      {
        query: (i: { query: string; steps: AgentStep[] }) => i.query,
        agent_scratchpad: (i: { query: string; steps: AgentStep[] }) => formatToOpenAIFunctionMessages(i.steps),
        results: () => results.join('\n'),
      },
      researchManagerPrompt,
      modelWithFunctions,
      new OpenAIFunctionsAgentOutputParser(),
    ]);
    const executor = AgentExecutor.fromAgentAndTools({
      agent: runnableAgent,
      tools: researchManagerTools,
    });
    const report = (await executor.invoke({
      query,
      results: results.join('\n'),
    })) as { input: string; output: string };

    return report.output;
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
}
