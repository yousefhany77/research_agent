# research-agent

## 2.0.0

### Major Changes

- # Changes for Version 2.0.0

  ## Summary

  Added chat history to each worker - so based on that, I removed the search worker from the constructor and added a config option to pass to the worker if needed.

  Also added notification for the whole flow: `search worker`, `ResearchManager`, and `tools` can now listen to notifications and act accordingly on every pipeline update.

  Added `searchWorkersToolsResults` to the `worker` to cache results and prevent searching again if the same query was made before by another worker or the same worker.

  Added support for more `LLMs` in certain operations:

  - `ResearchManager` if used without tools
  - `Question Generator` agent if the model supports structured output
  - `WebPageLoaderWithSummary` tool that summarizes the page content and returns the summary

  ### Example with Mistral AI

  ```ts
  import { WebPageLoaderWithSummary } from "research_agent";
  import { ChatMistralAI } from "@langchain/mistralai";

  const main = async (): Promise<void> => {
    const chatgpt = createOpenAIChatModel({
      modelName: "gpt-3.5-turbo",
    });
    const mistralai = new ChatMistralAI({
      apiKey: process.env.MISTRAL_API_KEY,
      modelName: "mistral-large-latest",
    });

    const questionGeneratorAgent = new QuestionGeneratorAgent(mistralai); // still not stable with mistral ai
    const researchManager = new ResearchManager(
      mistralai,
      questionGeneratorAgent,
      {
        maxIterations: 2,
        researchWorkerConfig: {
          llmModel: chatgpt,
          tools: {
            webLoader: new WebPageLoaderWithSummary(mistralai),
          },
        },
      },
    );
    const query = "Write a report about ramadan and its importance";
    await researchManager.search(query);
  };

  await main();
  ```

## 1.0.0

### Major Changes

- Search the web using the search agent

  ```ts
  import { writeFileSync } from "fs";
  import { ResearchManager } from "./lib/agents/ResearchManager/ResearchManager.js";
  const writeToFile = async (fileName: string, data: string) => {
    writeFileSync(fileName, data);
  };

  const main = async () => {
    const manager = new ResearchManager(); // you can customize the llm model
    const result = await manager.search(
      'Who is this person in that website "www.youssefhany.dev"?',
    );

    // write to a markdown file
    await writeToFile("output.md", result);
  };

  void main();
  ```

  ResearchManager is an agent that manages the research process.

  - It allows for customization by injecting an LLM model, a QuestionGeneratorAgent, and a SearchWorker.
  - @param llmModel (optional) The OpenAI chat model used by the ResearchManager.
  - @param questionGenerator (optional) The QuestionGeneratorAgent used by the ResearchManager. @see {@link QuestionGeneratorAgent}
  - @param searchWorker (optional) The SearchWorker used by the ResearchManager.
