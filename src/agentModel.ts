import { ChatOpenAI } from '@langchain/openai'
import { agentTools } from './agentTools'
import { cache } from './chatgptExample'

export const agentModel = new ChatOpenAI({
  maxConcurrency: 2,
  temperature: 0,
  cache: cache,
  model: 'gpt-4o-mini',
}).bindTools(agentTools)
