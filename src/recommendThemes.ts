import { llm } from './llm'
import { PromptTemplate } from '@langchain/core/prompts'
import { z } from 'zod'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import themes from './themes.json'
import { stepStructure } from './responseStructure'
import path from 'path'
import fs from 'fs'
const __dirname = new URL('.', import.meta.url).pathname
const ideasDir = path.join(__dirname, '../ideas')
const idea = z.object({
  name: z.string().describe('The name of the idea'),
  fictional: z.boolean().describe('Whether the idea is fictional or real world'),
  description: z.string().describe('A description of the idea'),
  likelyDistance: z.number().describe('The likely distance in kilometers of the whole route for the idea'),
  possibleSteps: z
    .array(
      stepStructure.omit({
        distance: true,
        credibility: true,
      })
    )
    .describe('Some of the likely steps of the idea'),
})
export const summaryParser = StructuredOutputParser.fromZodSchema(
  z.object({
    bestIdea: idea.describe('The idea for the route, which should be very specific to the theme.'),
    otherIdeas: z.array(idea).describe('Other ideas for the route'),
  })
)

export const routePrompt = PromptTemplate.fromTemplate(
  `
We are developing app. In this app, users can pick from routes. Fitbit will sync the users daily walking distances.

The app will track how far they would have theoretically walked if they had walked the route they picked.

The routes have themes. We need to recommend themes for the routes, and specify if they are fictional or real world.

This is the full list of themes. Use ideas for the chosen theme, that are specific to the theme, and wouldn't fit one of the other themes better.
~~~
${themes.map((t) => t.theme).join('\n')}
~~~

This is a list of existing ideas, do not reuse them.
~~~
{existingIdeas}
~~~
Here is the theme:
{theme}

Recommend routes for {themeName} based, based on real world or fictional locations most people would have heard of, that would fit into this theme.
These theme ideas should span at least a few hundred kilometers, ideally at a few thousand, and up to a few hundred thousand, and have at least 5 steps which could probably be found by googling.

{parser_instructions}

`.trim()
)

interface Itheme {
  theme: string
  filename: string
  primaryColor: string
  secondaryColor: string
  description: string
}
export async function recommendThemeIdea(theme: Itheme) {
  const existingIdeas = fs
    .readdirSync(ideasDir)
    .map((f) => {
      return JSON.parse(fs.readFileSync(path.join(ideasDir, f), 'utf-8'))
    })
    .map((i) => i.bestIdea.name)
  const response = await routePrompt
    .pipe(llm())
    .pipe(summaryParser)
    .invoke({
      existingIdeas,
      themeName: theme.theme,
      theme: JSON.stringify(theme, null, 2),
      parser_instructions: summaryParser.getFormatInstructions(),
    })
  return response
}
