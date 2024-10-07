
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { generateRoute } from './runWithInputParams'
import themes from './themes.json'

yargs(hideBin(process.argv))
  .scriptName('npm run arc')
  .usage('$0 <cmd> [args]')
  .command(
    'create',
    'create a new route',
    function (yargs) {
      return yargs
        .option('idea', {
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
          demand: false,
          describe: 'Whether the route is fictional',
        })
    },
    async (argv) => {
      await generateRoute(argv)
    }
  )
  .command('example', 'run the example', async () => {
    await generateRoute()
  })
  .help()
  .alias('help', 'h').argv
