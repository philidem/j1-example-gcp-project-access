import Logger from 'bunyan';

export { Logger };

const bunyanFormat = require('bunyan-format');

export function createLogger(options: {
  minLogLevel: 'trace' | 'info' | 'warn' | 'error';
}) {
  return Logger.createLogger({
    name: 'gcp-project-access',
    serializers: {
      err: Logger.stdSerializers.err,
    },
    streams: [{ stream: bunyanFormat({ outputMode: 'short' }) }],
    level: options.minLogLevel,
  });
}
