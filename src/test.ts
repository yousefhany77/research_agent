import { QuestionGeneratorAgent, ResearchManager, WebPageLoaderWithSummary } from './index.js';
import NotificationManager from './lib/notification/NotificationManager.js';
import createOpenAIChatModel from './utils/createOpenAIChatModel.js';

const main = async (): Promise<void> => {
  const chatgpt = createOpenAIChatModel({
    modelName: 'gpt-3.5-turbo',
  });
  const mistralai = chatgpt;

  NotificationManager.addListener(console.log);

  const questionGeneratorAgent = new QuestionGeneratorAgent(mistralai); // still not stable with mistral ai
  const researchManager = new ResearchManager(mistralai, questionGeneratorAgent, {
    maxIterations: 2,
    researchWorkerConfig: {
      llmModel: chatgpt,
      tools: {
        webLoader: new WebPageLoaderWithSummary(mistralai),
      },
    },
  });
  const query = 'Write a report about ramadan and its importance';
  await researchManager.search(query);
};

await main();
