
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { generateRoute } from './runWithInputParams'
import { boilDownResults, searchGoogle } from './tools/searchTool'
import { searchGoogleMaps } from './tools/mapsTools'
import themes from './themes.json'
import { recommendThemeIdea } from './recommendThemes'
import { mkdir, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import _ from 'lodash'
const __dirname = new URL('.', import.meta.url).pathname
yargs(hideBin(process.argv))
  .scriptName('npm run arc')
  .usage('$0 <cmd> [args]')
  .command(
    'create',
    'create a new route',
    function (yargs) {
      return yargs
        .option('routeIdea', {
          alias: 'i',
          type: 'string',
          demand: true,
          describe: 'The name of the route',
        })

        .option('fictional', {
          alias: 'f',
          type: 'boolean',
          demand: true,
          describe: 'Whether the route is fictional',
        })
    },
    async (argv) => {
      await generateRoute(argv)
    }
  )
  .command(
    'search',
    'Search using google search',
    (yargs) =>
      yargs
        .option('query', {
          alias: 'q',
          type: 'string',
          demand: true,
          describe: 'The query to search for',
        })
        .option('verbose', {
          alias: 'v',
          type: 'boolean',
          demand: false,
          default: false,
          describe: 'Whether to log the results',
        }),
    async (argv) => {
      const results = await searchGoogle(argv)
      if (!results) {
        console.log('No result')
        process.exit(1)
      }
      console.log(
        JSON.stringify(
          await boilDownResults({
            context: 'search query:' + argv.query,
            query: argv.query,
            results,
            verbose: argv.verbose,
          }),
          null,
          2
        )
      )

      process.exit(0)
    }
  )
  .command('example', 'run the example', async () => {
    await generateRoute()
  })
  .command(
    'distance',
    'calculate the distance between two places',
    (yargs) =>
      yargs
        .option('from', {
          alias: 'f',
          type: 'string',
          demand: true,
          describe: 'The starting location',
        })
        .option('to', {
          alias: 't',
          type: 'string',
          demand: true,
          describe: 'The destination location',
        })
        .option('verbose', {
          alias: 'v',
          type: 'boolean',
          demand: false,
          default: false,
          describe: 'Whether to log the results',
        }),
    async (argv) => {
      const distance = await searchGoogleMaps(argv)
      console.log('Distance:', JSON.stringify(distance, null, 2))
      process.exit(0)
    }
  )
  .command(
    'generate-ideas',
    'generate ideas for a route',
    (yargs) =>
      yargs.option('theme', {
        alias: 't',
        type: 'string',
        default: 'all',
        choices: ['all', ...themes.map((theme) => theme.theme)],
        describe: 'The theme of the route, otherwise all themes will be generated',
      }),
    async (argv) => {
      mkdirSync('ideas', { recursive: true })
      const singleTheme = themes.find((theme) => theme.theme === argv.theme)
      let themeList = themes
      if (singleTheme) {
        themeList = [singleTheme]
      }
      for (const theme of themeList) {
        const idea = await recommendThemeIdea(theme)
        console.log(theme.theme, JSON.stringify(idea, null, 2))
        writeFileSync(`ideas/${_.snakeCase(theme.theme)}.json`, JSON.stringify(idea, null, 2))
      }
      process.exit(0)
    }
  )
  .command(
    'generate-routes-from-ideas',
    'generate routes from ideas',
    (yargs) =>
      yargs
        .option('theme', {
          alias: 't',
          type: 'string',
          default: 'all',
          choices: ['all', ...themes.map((theme) => theme.theme)],
          describe: 'The theme of the route',
        })
        .option('limit', {
          alias: 'l',
          type: 'number',
          default: 5,
          describe: 'The number of routes to generate',
        }),
    async (argv) => {
      let exitCode = 0
      mkdirSync('generated_routes', { recursive: true })
      const skip: { [filename: string]: boolean } = {}
      readdirSync('generated_routes').forEach((file) => {
        skip[file] = true
      })

      const themeList = argv.theme === 'all' ? themes : themes.filter((theme) => theme.theme === argv.theme)
      let generatedCount = 0
      for (const theme of themeList) {
        const filename = _.snakeCase(theme.theme) + '.json'
        console.log('Checking', filename, skip[filename])
        if (skip[filename]) {
          console.log('Skipping', filename)
          continue
        }
        generatedCount++
        if (generatedCount > argv.limit) {
          break
        }
        const idea = JSON.parse(readFileSync(path.join(`ideas/${_.snakeCase(theme.theme)}.json`), 'utf-8'))
        const bestIdea = `
My idea is a route for "${idea.bestIdea.name}", which is ${idea.bestIdea.fictional ? 'fictional' : 'real world'}.
The  pitch for this route is "${idea.bestIdea.description}".
Some ideas for steps are: \n${idea.bestIdea.possibleSteps
          .map((step) => `\t - ${step.startingLocation} to ${step.endingLocation}`)
          .join('\n')}
        `.trim()
        console.log('Generating routes from ideas', idea.bestIdea.name)
        console.log(bestIdea)
        console.log('\n\n\n\n')
        try {
          const result = await generateRoute({ routeIdea: bestIdea, fictional: idea.bestIdea.fictional })
          console.log('Generated route: ', idea.bestIdea.name, JSON.stringify(result, null, 2))
          writeFileSync(`generated_routes/${filename}`, JSON.stringify(result, null, 2))
        } catch (e) {
          console.error('Error generating route', e)
          exitCode = 1
        }
      }
      process.exit(exitCode)
    }
  )
  .help()
  .alias('help', 'h').argv
