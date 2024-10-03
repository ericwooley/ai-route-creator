
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runAgent } from './find-routes';

yargs(hideBin(process.argv))
  .scriptName("npm run arc")
  .usage('$0 <cmd> [args]')
  .command('generate [name]', 'generate a new route', (yargs) => {
    return yargs.positional('name', {
      type: 'string',
      demand: true,
      describe: 'The name of the route'
    }).option('context', {
      alias: 'c',
      type: 'string',
      demand: true,
      describe: 'Adds context to the request'
    });
  }, (argv) => {
    console.log(argv);
     runAgent().then(() => {
      process.exit(0)
     })
  })
  .help()
  .alias('help', 'h')
  .argv;