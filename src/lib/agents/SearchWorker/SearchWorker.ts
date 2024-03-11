/**
 * Represents a SearchWorker class that performs search operations using various tools.
 */
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { BaseCallbackHandler } from 'langchain/callbacks';
import { Serialized } from 'langchain/load/serializable';
import { ChatMessageHistory } from 'langchain/memory';
import { RunnableWithMessageHistory } from 'langchain/runnables';

import { DynamicStructuredTool, Tool } from 'langchain/tools';
import NotificationManager, { Notification, NotificationActor } from '~/lib/notification/NotificationManager.js';
import { createWebLoaderTool } from '~/lib/tools/WebPageLoader.js';
import { Env } from '~/utils/Env.js';
import createOpenAIChatModel from '~/utils/createOpenAIChatModel.js';
import { generateName } from '~/utils/genrateRandomNames.js';

export class SearchWorker {
  private readonly tools: Record<string, Tool | DynamicStructuredTool>;
  public readonly workerName = generateName('Search Worker: ');
  private messageHistory = new ChatMessageHistory();
  private prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You Are a Search Worker. You have been asked to search for the following query:{input} and you need to find the best information and finish the task. and write a report about your findings. and if there is a chat history you should use it to help you in your search. you have a set of tools that you can use to help you in your search',
    ],
    new MessagesPlaceholder('chat_history'),
    new MessagesPlaceholder('agent_scratchpad'),
    ['human', '{input}'],
  ]);

  /**
   * Creates an instance of SearchWorker.
   * @param llmModel The OpenAI chat model used by the SearchWorker.
   */
  constructor(
    private readonly llmModel = createOpenAIChatModel(),
    private readonly researchResults: Record<string, string> = {},
    tools?: Record<string, Tool | DynamicStructuredTool> & Partial<DefaultTools>
  ) {
    this.tools = {
      search: new TavilySearchResults({ maxResults: 1, apiKey: Env.get('TAVILY_API_KEY').toString() }),
      webLoader: createWebLoaderTool(this.researchResults),
      ...tools,
    };
    this.notify({
      message: `${this.workerName} has been initialized`,
      type: 'SearchWorker:initialized',
    });
  }

  /**
   * Performs a search operation using the specified query.
   * @param query The search query.
   * @returns A promise that resolves to the search result as a string.
   */
  public async search(input: string): Promise<string> {
    this.notify({
      message: `SearchWorker is searching for "${input}"`,
      type: 'SearchWorker:Task:Start',
      payload: { query: input },
    });

    const tools = Object.values(this.tools);
    const agent = await createOpenAIToolsAgent({
      llm: this.llmModel,
      tools,
      prompt: this.prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });
    const agentWithChatHistory = new RunnableWithMessageHistory({
      runnable: agentExecutor,
      getMessageHistory: () => this.messageHistory,
      inputMessagesKey: 'input',
      historyMessagesKey: 'chat_history',
    });

    const response = (await agentWithChatHistory.invoke(
      {
        input,
      },
      {
        callbacks: [new SearchWorkerCallbackHandlers()],
        runName: this.workerName,
        configurable: {
          sessionId: this.workerName,
        },
      }
    )) as { output: string };

    this.notify({
      message: `SearchWorker has finished searching for "${input}"`,
      type: 'SearchWorker:Task:End',
      payload: { query: input, response },
    });

    return `# Report on "${input}"\n${response.output}`;
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

  private notify({ message, type, payload }: Pick<Notification, 'message' | 'type' | 'payload'>): void {
    return NotificationManager.notify({
      actor: NotificationActor.SearchWorker,
      createdAt: new Date(),
      createdBy: this.workerName,
      message,
      type,
      payload,
    });
  }
}

type DefaultTools = {
  search: TavilySearchResults;
  webLoader: ReturnType<typeof createWebLoaderTool>;
};

class SearchWorkerCallbackHandlers extends BaseCallbackHandler {
  name = 'SearchWorkerCallbackHandlers';
  private getToolName(runId: string, tool?: Serialized): string {
    if (!tool) {
      return this.runMap.get(runId) ?? 'unknown tool';
    }
    const toolName = tool?.id?.[tool.id.length - 1] ?? 'unknown tool';
    this.runMap = this.runMap.set(runId, toolName);
    return toolName;
  }
  private runMap = new Map<string, string>();

  handleToolStart(
    tool: Serialized,
    input: string, // serialized json
    runId: string
  ): void {
    const toolName = this.getToolName(runId, tool);
    NotificationManager.notify({
      actor: NotificationActor.SearchWorker,
      createdAt: new Date(),
      createdBy: 'SearchWorker',
      message: `SearchWorker is using ${toolName} to search for "${input}"`,
      type: 'SearchWorker:Tool:Start',
      payload: { tool, input, runId },
    });
  }
  handleToolEnd(
    output: string, // serialized json
    runId: string
  ): void {
    const toolName = this.runMap.get(runId);
    NotificationManager.notify({
      actor: NotificationActor.SearchWorker,
      createdAt: new Date(),
      createdBy: 'SearchWorker',
      message: `SearchWorker has finished using ${toolName} to search`,
      type: 'SearchWorker:Tool:End',
      payload: { output, runId },
    });
  }
}
