import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseLanguageModelInterface } from 'langchain/base_language';
import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer';
import { ChatPromptTemplate } from 'langchain/prompts';
import { DynamicStructuredTool } from 'langchain/tools';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { z } from 'zod';

const schema = z.object({
  url: z.string().describe('The URL of the web page to load. and scrape the content from.'),
});

const func = async (
  { url }: z.infer<typeof schema>,
  opinions?: ConstructorParameters<typeof PuppeteerWebBaseLoader>[1]
): Promise<string> => {
  const loaderWithOptions = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: 'new',
    },
    gotoOptions: {
      waitUntil: 'networkidle2',
    },
    ...opinions,
  });
  // remove the html tags and convert it to markdown
  const content = NodeHtmlMarkdown.translate(await loaderWithOptions.scrape());
  return content;
};

const createWebLoaderTool = (searchResult?: Record<string, string>): DynamicStructuredTool =>
  new DynamicStructuredTool({
    name: 'Web_Page_Loader',
    schema,
    description:
      'This tool loads a web page and returns the content as a string. by using puppeteer to scrape the page. You should pass the URL as input',

    func: async ({ url }: z.infer<typeof schema>): Promise<string> => {
      if (searchResult?.[url]) {
        return searchResult[url];
      }
      const html = await func({ url });
      if (searchResult) searchResult[url] = `I already loaded this page and here is the content for it: \n${html}`;
      return html;
    },
  });

class WebPageLoaderWithSummary extends DynamicStructuredTool {
  public prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `You are an AI assistant tasked with summarizing web pages in a comprehensive and informative way. Your goal is to provide the reader with a thorough understanding of the content and key highlights of the webpage, rather than just a brief overview.
      Please maintain an objective and impartial tone throughout the summary. Avoid subjective judgments or opinions unless they are directly relevant to the content itself.
      The summary should be detailed enough to give the reader a comprehensive understanding of the webpage, but concise enough to be easily readable. Use clear language and formatting (headings, bullet points, etc.) to improve clarity and scanability.
      and take notes to help you remember the key points of the page.`,
    ],
    ['human', '{input}'],
    ['human', 'Summarize to answer {q}'],
  ]);
  constructor(
    llmModel: BaseLanguageModelInterface,
    puppeteerOptions?: ConstructorParameters<typeof PuppeteerWebBaseLoader>[1]
  ) {
    super({
      name: 'Web_Page_Loader_With_Summary',
      schema: z.object({
        url: z.string().describe('The URL of the web page to load and summarize.'),
        question: z.string().describe('The question to answer in the summary.'),
      }),
      description:
        'This tool loads a web page and returns the content as a string. by using puppeteer to scrape the page. You should pass the URL as input',

      func: async ({ url, question }: { url: string; question?: string }): Promise<string> => {
        if (this.searchResult?.[url]) {
          console.log(`No need to load the page again, using the cached result for =>${url}" 🔎`);
          return this.searchResult[url];
        }

        const text = await func({ url }, puppeteerOptions);

        const summary = await this.prompt
          .pipe(llmModel)
          .pipe(new StringOutputParser())
          .invoke(
            {
              input: text,
              q: question ?? "What's the summary of this page?",
            },
            {
              runName: 'Web page summarizer',
            }
          );
        this.searchResult[url] = `I already loaded this page and here is the summary for it: \n${summary}`;
        return summary;
      },
    });
  }
  public searchResult: Record<string, string> = {};
}

export { WebPageLoaderWithSummary, createWebLoaderTool };
