/**
 * Represents a SearchWorker class that performs search operations using various tools.
 */
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer';
import { formatDocumentsAsString } from 'langchain/util/document';

import { WikipediaQueryRun } from '@langchain/community/tools/wikipedia_query_run';
import { DynamicTool, Tool } from 'langchain/tools';
import { Env } from '~/utils/Env.js';
import createOpenAIChatModel from '~/utils/createOpenAIChatModel.js';
const webLoaderTool = new DynamicTool({
  name: 'Web_Page_Loader',
  description:
    'This tool loads a web page and returns the content as a string. by using puppeteer to scrape the page. You should pass the URL as input',

  func: async (url): Promise<string> => {
    console.log(`🔎 Using Web_Page_Loader Tool to load "${url}" 🔎`);
    const loaderWithOptions = new PuppeteerWebBaseLoader(url);
    const content = await loaderWithOptions.load();
    return formatDocumentsAsString(content);
  },
});

const wikipediaSearch = new WikipediaQueryRun({
  topKResults: 3,
  maxDocContentLength: 4000,
});

export class SearchWorker {
  private readonly tools: Record<string, Tool> = {
    search: new TavilySearchResults({ maxResults: 1, apiKey: Env.get('TAVILY_API_KEY').toString() }),
    webLoader: webLoaderTool,
    wikipediaSearch,
  };

  /**
   * Creates an instance of SearchWorker.
   * @param llmModel The OpenAI chat model used by the SearchWorker.
   */
  constructor(private readonly llmModel = createOpenAIChatModel()) {}

  /**
   * Performs a search operation using the specified query.
   * @param query The search query.
   * @returns A promise that resolves to the search result as a string.
   */
  public async search(input: string): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You Are a Search Worker. You have been asked to search for the following query:{input} and you need to find the best information and finish the task. and write a report about your findings. and if there is a chat history you should use it to help you in your search. you have a set of tools that you can use to help you in your search',
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const tools = Object.values(this.tools);
    const agent = await createOpenAIFunctionsAgent({
      llm: this.llmModel,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });

    const response = (await agentExecutor.invoke({
      input,
    })) as { output: string };

    console.log('SearchWorker: Search result', response?.output);
    return response?.output ?? 'No results found';
  }

  /**
   * Adds a tool to the SearchWorker.
   * @param name The name of the tool. @see Tool - {@link https://js.langchain.com/docs/integrations/tools}
   * @param tool The tool to be added.
   */
  public addTool(name: string, tool: Tool): void {
    this.tools[name] = tool;
  }

  /**
   * Removes a tool from the SearchWorker.
   * @param name The name of the tool to be removed.
   */
  public removeTool(name: string): void {
    delete this.tools[name];
  }
}
