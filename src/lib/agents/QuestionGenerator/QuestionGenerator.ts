import * as z from 'zod';

import { ChatPromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { BaseChatModel } from 'langchain/chat_models/base';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { RunnableSequence } from 'langchain/runnables';
import { HumanMessage } from 'langchain/schema';
import NotificationManager, { Notification, NotificationActor } from '~/lib/notification/NotificationManager.js';
import createOpenAIChatModel from '~/utils/createOpenAIChatModel.js';

class QuestionGeneratorAgent {
  private readonly zodSchema = z.object({
    questions: z.array(z.string()),
  });
  private readonly parser = StructuredOutputParser.fromZodSchema(this.zodSchema);

  constructor(
    private readonly llmModel: BaseChatModel = createOpenAIChatModel(),
    private qCount: number = 2
  ) {
    NotificationManager.notify({
      message: 'QuestionGeneratorAgent initialized',
      actor: NotificationActor.QuestionGeneratorAgent,
      type: 'QuestionGeneratorAgent:initialized',
      createdAt: new Date(),
      createdBy: 'QuestionGeneratorAgent',
    });
  }

  private notify({ message, type, payload }: Pick<Notification, 'message' | 'type' | 'payload'>): void {
    return NotificationManager.notify({
      actor: NotificationActor.QuestionGeneratorAgent,
      createdAt: new Date(),
      createdBy: 'QuestionGeneratorAgent',
      message,
      type,
      payload,
    });
  }
  private async _generateQuestionsLegacy(question: string): Promise<z.infer<typeof this.zodSchema>> {
    const selfQueryPrompt = new ChatPromptTemplate<
      {
        question: string;
        format_instructions: string;
        q_count: number;
      },
      string
    >({
      promptMessages: [
        SystemMessagePromptTemplate.fromTemplate(
          'Given the question "{question}", I will generate a list of questions that are related to the original question with max of {q_count} that will be used to preform a google search. that will help me to make a better report about the topic.\n{format_instructions}\n{question}'
        ),
        new HumanMessage('question: {question}'),
      ],

      inputVariables: ['question', 'format_instructions', 'q_count'],
    });

    selfQueryPrompt.name = '@prompt/selfQuery';

    z.string().parse(question);
    const chain = RunnableSequence.from([selfQueryPrompt, this.llmModel, this.parser]);

    const response = await chain.invoke(
      {
        question,
        format_instructions: this.parser.getFormatInstructions(),
        q_count: this.qCount,
      },
      {
        runName: 'QuestionGeneratorAgent',
      }
    );

    return response;
  }

  public async generateQuestions(question: string): Promise<z.infer<typeof this.zodSchema>> {
    const results = {
      questions: [] as string[],
    };
    this.notify({
      message: `QuestionGeneratorAgent is generating questions for "${question}"`,
      type: `${NotificationActor.QuestionGeneratorAgent}:Task:Start`,
      payload: { question },
    });
    const selfQueryPrompt = new ChatPromptTemplate<
      {
        question: string;
        q_count: number;
      },
      string
    >({
      promptMessages: [
        SystemMessagePromptTemplate.fromTemplate(
          'Given the question "{question}", I will generate a list of questions that are related to the original question with max of {q_count} that will be used to preform a google search. that will help me to make a better report about the topic. \nQuestion:{question}'
        ),
        new HumanMessage('question: {question}'),
      ],
      inputVariables: ['question', 'q_count'],
    });

    selfQueryPrompt.name = '@prompt/selfQuery';

    if (this.llmModel.withStructuredOutput) {
      const modelWithTool = this.llmModel.withStructuredOutput(this.zodSchema);
      const chain = selfQueryPrompt.pipe(modelWithTool);
      const { questions } = await chain.invoke(
        { question, q_count: this.qCount },
        {
          runName: 'QuestionGeneratorAgent',
        }
      );
      results.questions = questions;
    } else {
      const { questions } = await this._generateQuestionsLegacy(question);
      results.questions = questions;
    }
    this.notify({
      message: `QuestionGeneratorAgent has finished generating questions for "${question}"`,
      type: `${NotificationActor.QuestionGeneratorAgent}:Task:End`,
      payload: { question, results },
    });
    return results;
  }
}

export { QuestionGeneratorAgent };
