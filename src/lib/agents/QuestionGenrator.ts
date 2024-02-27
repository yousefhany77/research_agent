import { ChatOpenAI } from '@langchain/openai';
import * as z from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Env } from '~/utils/Env.js';

import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { JsonOutputFunctionsParser } from 'langchain/output_parsers';

const selfQueryPrompt = new ChatPromptTemplate<
  {
    question: string;
  },
  string
>({
  promptMessages: [
    SystemMessagePromptTemplate.fromTemplate(
      'Given the question "{question}", I will generate a list of questions that are related to the original question. that will help me to make a better report about the topic.'
    ),
    HumanMessagePromptTemplate.fromTemplate('{question}'),
  ],
  inputVariables: ['question'],
});

selfQueryPrompt.name = '@prompt/selfQuery';

export { selfQueryPrompt };

class QuestionGeneratorAgent {
  readonly zodSchema = z.object({
    questions: z.array(z.string()),
  });

  constructor(
    private readonly llmModel = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo-0613',
      temperature: 0,
      openAIApiKey: Env.get('OPEN_AI_API_KEY').toString(),
    })
  ) {
    this.llmModel.bind({
      runName: 'llm_with_function_call',
      functions: [
        {
          name: 'output_formatter',
          description: 'Should always be used to properly format output',
          parameters: zodToJsonSchema(this.zodSchema),
        },
      ],
      function_call: { name: 'output_formatter' },
    });
  }

  async generateQuestions(question: string): Promise<z.infer<typeof this.zodSchema>> {
    z.object({ question: z.string() }).parse({ question });
    const outputParser = new JsonOutputFunctionsParser<z.infer<typeof this.zodSchema>>();

    const chain = selfQueryPrompt.pipe(this.llmModel).pipe(outputParser);
    return chain.invoke({ question });
  }
}

export { QuestionGeneratorAgent };
