/* eslint-disable @typescript-eslint/no-unused-vars */
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { SimpleChatModel, type BaseChatModelParams } from '@langchain/core/language_models/chat_models';
import { AIMessageChunk, type BaseMessage } from '@langchain/core/messages';
import { ChatGenerationChunk } from '@langchain/core/outputs';

export interface FakeChatModelInput extends BaseChatModelParams {
  response: string;
}

export class FakeChatModel extends SimpleChatModel {
  private response: string;

  constructor(fields: FakeChatModelInput) {
    super(fields);
    this.response = fields.response;
  }

  public _llmType(): string {
    return 'custom';
  }

  async _call(
    messages: BaseMessage[],
    _options: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    if (!messages.length) {
      throw new Error('No messages provided.');
    }
    // Pass `runManager?.getChild()` when invoking internal runnables to enable tracing
    // await subRunnable.invoke(params, runManager?.getChild());
    if (typeof messages[0].content !== 'string') {
      throw new Error('Multimodal messages are not supported.');
    }
    return new Promise((resolve) => {
      resolve(this.response);
    });
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    if (!messages.length) {
      throw new Error('No messages provided.');
    }
    if (typeof messages[0].content !== 'string') {
      throw new Error('Multimodal messages are not supported.');
    }
    // Pass `runManager?.getChild()` when invoking internal runnables to enable tracing
    // await subRunnable.invoke(params, runManager?.getChild());
    for (const letter of messages[0].content.slice(0, this.response.length)) {
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: letter,
        }),
        text: letter,
      });
      await runManager?.handleLLMNewToken(letter);
    }
  }
}
