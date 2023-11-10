
exports.command = 'tools <command>';
exports.desc = 'Crawling tools';
exports.builder = function (yargs) {
  return yargs.commandDir('tools');
};
exports.handler = function () {};
