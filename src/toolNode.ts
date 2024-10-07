import { ToolNode } from '@langchain/langgraph/prebuilt'
import { agentTools } from './agentTools'

export const toolNode = new ToolNode(agentTools)
