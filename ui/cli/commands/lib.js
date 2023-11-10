
exports.command = 'lib <command>';
exports.desc = 'Library tools';
exports.builder = function (yargs) {
  return yargs.commandDir('lib');
};
exports.handler = function () {};
