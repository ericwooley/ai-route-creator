
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runAgent } from './find-routes';
import { executeGraph } from './chatgptExample'

yargs(hideBin(process.argv))
  .scriptName('npm run arc')
  .usage('$0 <cmd> [args]')
  .command(
    'create [name]',
    'create a new route',
    function (yargs) {
      return yargs.positional('name', {
        type: 'string',
        demand: true,
        describe: 'The name of the route',
      })
    },
    (argv) => {
      console.log(argv)
      runAgent({
        question: argv.name,
      }).then(() => {
        process.exit(0)
      })
    }
  )
  .command('example', 'run the example', async () => {
    await executeGraph()
  })
  .help()
  .alias('help', 'h').argv
