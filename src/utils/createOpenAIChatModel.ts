import { AzureOpenAIInput, ChatOpenAI, OpenAIChatInput } from '@langchain/openai';
import { BaseChatModelParams } from 'langchain/chat_models/base';
import { Env } from './Env.js';

function createOpenAIChatModel(
  options?: Partial<OpenAIChatInput> & Partial<AzureOpenAIInput> & BaseChatModelParams
): ChatOpenAI {
  return new ChatOpenAI({
    modelName: 'gpt-4-turbo-preview',
    temperature: 0,
    maxTokens: 4000,
    openAIApiKey: Env.get('OPEN_AI_API_KEY').toString(),
    cache: true,
    ...options,
  });
}

export default createOpenAIChatModel;
