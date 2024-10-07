import { ToolNode } from '@langchain/langgraph/prebuilt'
import { TavilySearchResults } from '@langchain/community/tools/tavily_search'

export const agentTools = [new TavilySearchResults({ maxResults: 20, verbose: true })]
export const toolNode = new ToolNode(agentTools)


