
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { generateRoute } from './runWithInputParams'
import { boilDownResults, searchGoogle } from './tools/searchTool'
import { searchGoogleMaps } from './tools/mapsTools'

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
  .help()
  .alias('help', 'h').argv
