import { TavilySearchResults } from '@langchain/community/tools/tavily_search'

// Define the tools for the agent to use
export const agentTools = [new TavilySearchResults({ maxResults: 20, verbose: true })]
