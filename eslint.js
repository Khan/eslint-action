// @flow

/**
 * This action runs `eslint` and reports any type errors it encounters.
 *
 * It expects the path to the `eslint` module to be provided as the first
 * and only command-line argument.
 *
 * It uses `send-report.js` to support both running locally (reporting to
 * stdout) and under Github Actions (adding annotations to files in the GitHub
 * UI).
 */

// $FlowFixMe: shhhhh
require('@babel/register'); // flow-uncovered-line

const sendReport = require('actions-utils/send-report');
const gitChangedFiles = require('actions-utils/git-changed-files');
const getBaseRef = require('actions-utils/get-base-ref');
const core = require('@actions/core');

const path = require('path');
const chalk = require('chalk');

chalk.enabled = !process.env.GITHUB_TOKEN;

/*::
import type {Message} from 'actions-utils/send-report';
import type {Formatter, LintReport, LintResult} from './types.js';
*/

const eslintAnnotations = async (
    eslintDirectory /*: string */,
    files /*: Array<string> */,
) /*: Promise<Array<Message>> */ => {
    /* flow-uncovered-block */
    // $FlowFixMe: flow can't handle custom requires
    const eslint = require(path.resolve(eslintDirectory));

    let results /*: Array<LintResult> */ = [];
    let formatter /*: Formatter */;

    if (eslint.ESLint) {
        core.info(`version: ${eslint.ESLint.version}`);
        const cli = new eslint.ESLint();
        formatter = cli.loadFormatter("stylish");
        results = await cli.lintFiles(files);
    } else if (eslint.CLIEngine) {
        // Handle old versions of eslint (< 7)
        core.info(`version: ${eslint.CLIEngine.version}`);
        const cli = new eslint.CLIEngine();
        formatter = {
            format: cli.getFormatter("stylish"),
        };
        const report /*: LintReport */ = cli.executeOnFiles(files);
        /* end flow-uncovered-block */
        results = report.results;
    } else {
        throw new Error(`'eslint-lib: ${eslintDirectory}' is incorrect`);
    }

    console.log("formatter");
    console.log(formatter);

    // We log all results since the number of annotations we can have is limited.
    core.startGroup('Results:');
    core.info(formatter.format(results));
    core.endGroup();

    const annotations /*: Array<Message> */ = [];
    for (const result of results) {
        const {filePath, messages} = result;
        for (const msg of messages) {
            const {line, column, severity, ruleId, message} = msg;
            if (!ruleId || severity === 0) {
                // it's probably the warning about a given file being ignored
                // by .eslintignore, which is fine.
                continue;
            }
            annotations.push({
                path: filePath,
                start: {line, column},
                end: {line, column},
                annotationLevel: severity === 1 ? 'warning' : 'failure',
                message: `${chalk.red(`[${ruleId}]`)} ${message}`,
            });
        }
    }

    return annotations;
};

async function run() {
    const eslintDirectory = process.env['INPUT_ESLINT-LIB'];
    const workingDirectory = process.env['INPUT_CUSTOM-WORKING-DIRECTORY'];
    const subtitle = process.env['INPUT_CHECK-RUN-SUBTITLE'];
    if (!eslintDirectory) {
        core.error(
            `You need to have eslint installed, and pass in the directory where it is located via the variable 'eslint-lib'.`,
        );
        process.exit(1);
        return;
    }
    // const [_, __, eslintDirectory] = process.argv;
    const baseRef = getBaseRef();
    if (!baseRef) {
        core.error(`No base ref given`);
        process.exit(1);
        return;
    }

    const files = await gitChangedFiles(baseRef, workingDirectory || '.');
    const validExt = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];
    const jsFiles = files.filter(file => validExt.includes(path.extname(file)));

    const cwd = process.cwd();
    core.startGroup('Running eslint on the following files:');
    for (const file of jsFiles) {
        core.info(path.relative(cwd, file));
    }
    core.endGroup();

    if (!jsFiles.length) {
        core.info('No JavaScript files changed');
        return;
    }
    const annotations = await eslintAnnotations(eslintDirectory, jsFiles);
    await sendReport(`Eslint${subtitle ? ' - ' + subtitle : ''}`, annotations);
}

// flow-next-uncovered-line
run().catch(err => {
    core.error(err); // flow-uncovered-line
    process.exit(1);
});
