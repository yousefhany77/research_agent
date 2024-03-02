import * as z from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { ChatPromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { RunnableSequence } from 'langchain/runnables';
import createOpenAIChatModel from '~/utils/createOpenAIChatModel.js';

const selfQueryPrompt = new ChatPromptTemplate<
  {
    question: string;
    format_instructions: string;
  },
  string
>({
  promptMessages: [
    SystemMessagePromptTemplate.fromTemplate(
      'Given the question "{question}", I will generate a list of questions that are related to the original question with max of 10 that will be used to preform a google search. that will help me to make a better report about the topic.\n{format_instructions}\n{question}'
    ),
  ],
  inputVariables: ['question', 'format_instructions'],
});

selfQueryPrompt.name = '@prompt/selfQuery';

export { selfQueryPrompt };

class QuestionGeneratorAgent {
  private readonly zodSchema = z.object({
    questions: z.array(z.string()),
  });
  private readonly parser = StructuredOutputParser.fromZodSchema(this.zodSchema);

  constructor(private readonly llmModel = createOpenAIChatModel()) {
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
    z.string().parse(question);
    const chain = RunnableSequence.from([selfQueryPrompt, this.llmModel, this.parser]);
    console.log(`QuestionGeneratorAgent: Generating questions for "${question}"`);

    const response = await chain.invoke({
      question,
      format_instructions: this.parser.getFormatInstructions(),
    });

    return response;
  }
}

export { QuestionGeneratorAgent };
