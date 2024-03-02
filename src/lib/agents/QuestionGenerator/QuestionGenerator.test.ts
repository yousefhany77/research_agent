import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { FakeChatModel } from '../../llm/FakeChatModel.js';
import { QuestionGeneratorAgent } from './QuestionGenerator.js';

const questions = [
  'What is the capital of France?',
  'What is the population of France?',
  'What is the currency of France?',
];
describe('QuestionGeneratorAgent', () => {
  let questionGenerator: QuestionGeneratorAgent;

  beforeEach(() => {
    questionGenerator = new QuestionGeneratorAgent(
      // @ts-expect-error
      new FakeChatModel({
        response: JSON.stringify({
          questions,
        }),
      })
    );
  });

  it('should generate array of questions', async () => {
    const question = 'What is the capital of France?';
    const result = await questionGenerator.generateQuestions(question);
    expect(result).toEqual({ questions });
  });

  it('should throw error if question is not provided', async () => {
    // @ts-expect-error
    await expect(questionGenerator.generateQuestions()).rejects.toThrow(ZodError);
  });
});
