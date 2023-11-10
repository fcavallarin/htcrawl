#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

yargs(hideBin(process.argv))
  .scriptName("htcrawl")
  .usage('$0 <cmd> [args]')
  .commandDir('commands', {
    visit: (commandObject, pathToFile, filename) => {
      return commandObject;
    },
    recurse: false,
    extensions: ['js'],
  })
  .demandCommand(1, 'A command is mandatory')
  .strict()
  .help()
  .alias('help', 'h')
  .version(false)
  .argv;
