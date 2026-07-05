process.chdir(__dirname);
const port = process.env.PORT || '3472';
process.argv = [process.argv[0], __filename, 'dev', '--port', port];
require('./node_modules/next/dist/bin/next');
