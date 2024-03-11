import { WikipediaQueryRun } from 'langchain/tools';

export const wikipediaSearch = new WikipediaQueryRun({
  topKResults: 3,
  maxDocContentLength: 4000,
});
