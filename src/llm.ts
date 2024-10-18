import { ChatOpenAI } from '@langchain/openai'
import { cache } from './cache'

export const llm = () =>
  new ChatOpenAI({
    maxConcurrency: 2,
    temperature: 0,
    cache: cache,
    // model: 'gpt-4o-mini',
    model: 'gpt-4o',
  })
