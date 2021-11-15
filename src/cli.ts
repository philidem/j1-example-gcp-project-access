import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import PQueue from 'p-queue';
import yargs from 'yargs';
import { createJupiterOneClient } from '~/src/j1Client/index';
import { collectProjectAccess } from './collect/collectProjectAccess';
import { createLogger } from './logging';
import { printReport } from './printReport';

const REQUIRED_ENV_PROPERTIES = {
  J1_ACCOUNT_ID: true,
  J1_API_KEY: true,
};

type EnvConfig = {
  [key in keyof typeof REQUIRED_ENV_PROPERTIES]: string;
} & {
  J1_BASE_URL?: string;
};

async function run() {
  const argv = yargs
    .option('--role', {
      description: 'Roles to filter by (repeatable)',
      type: 'array',
    })
    .option('--config', {
      description: 'Config file',
      default: '.env',
      type: 'string',
    })
    .option('-f', {
      description: 'Output file',
      default: 'gcp-project-access.json',
      type: 'string',
    })
    .option('--log-level', {
      description: 'Minimum level to log',
      default: 'warn',
      type: 'string',
      choices: ['trace', 'info', 'warn', 'error'],
    })
    .option('--report', {
      description: 'Print report',
      default: false,
      type: 'boolean',
    })
    .usage('$0 [options]')
    .help().argv as {
    role?: string[];
    f?: string;
    configFile?: string;
    report?: boolean;
    logLevel?: 'trace' | 'info' | 'warn' | 'error';
  };

  const envFile = argv.configFile!;
  const env = dotenv.config({
    path: envFile,
  });

  const errors: string[] = [];
  for (const key of Object.keys(REQUIRED_ENV_PROPERTIES)) {
    const value = env.parsed?.[key]?.trim();
    if (!value) {
      errors.push(`"${key} is required in ${envFile}`);
    }
  }

  if (errors.length) {
    process.exitCode = 2;
    console.error(
      `Errors:\n${errors
        .map((error) => {
          return `- ${error}\n`;
        })
        .join('')}`
    );
    return;
  }

  const context = {
    logger: createLogger({
      minLogLevel: argv.logLevel!,
    }),
  };

  const { logger } = context;

  const envConfig = env.parsed as EnvConfig;

  const j1Client = createJupiterOneClient({
    accountId: envConfig.J1_ACCOUNT_ID,
    apiKey: envConfig.J1_API_KEY,
    apiBaseUrl: envConfig.J1_BASE_URL ?? 'https://api.us.jupiterone.io',
  });

  const j1qlWorkQueue = new PQueue({
    concurrency: 5,
  });

  const filterByRole = new Set(argv.role);

  const output = await collectProjectAccess(context, {
    j1Client,
    j1qlConcurrency: 5,
    j1qlWorkQueue,
    filterByRole,
  });

  await fs.writeFile(
    argv.f!,
    JSON.stringify(
      {
        filterByRole: [...filterByRole],
        projects: output.projects,
      },
      null,
      2
    )
  );

  if (argv.report) {
    printReport(context, output);
  }

  logger.info('Done');
}

run().catch((err) => {
  process.exitCode = 1;
  console.error(`Error collecting GCP project access. Error: ${err.stack}`);
});
