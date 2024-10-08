
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { generateRoute } from './runWithInputParams'
import themes from './themes.json'
import { boilDownResults, searchGoogle } from './tools/searchTool'

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
        .option('theme', {
          alias: 't',
          type: 'string',
          demand: true,
          describe: 'The theme of the route',
          choices: themes.map((theme) => theme.theme),
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
  .help()
  .alias('help', 'h').argv
