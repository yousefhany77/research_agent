# research-agent

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
