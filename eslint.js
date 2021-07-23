#!/usr/bin/env node
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
const {getBaseRef, cannedGithubErrorMessage} = require('actions-utils/get-base-ref');

const path = require('path');
const chalk = require('chalk');

chalk.enabled = !process.env.GITHUB_TOKEN;

/*::
import type {Message} from 'actions-utils/send-report';
*/

const eslintAnnotations = (
    eslintDirectory /*: string*/,
    files /*: Array<string>*/,
) /*: Array<Message>*/ => {
    /* flow-uncovered-block */
    // $FlowFixMe: flow can't handle custom requires
    const eslint = require(path.resolve(eslintDirectory));

    const cli = new eslint.CLIEngine();
    const report /*: {
        results: Array<{
            filePath: string,
            messages: Array<{
                line: number,
                column: number,
                severity: number,
                ruleId: string,
                message: string,
            }>
        }>
    } */ = cli.executeOnFiles(
        files,
    );
    /* end flow-uncovered-block */
    const {results} = report;

    const annotations = [];
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
        console.error(
            `You need to have eslint installed, and pass in the directory where it is located via the variable 'eslint-lib'.`,
        );
        process.exit(1);
        return;
    }
    // const [_, __, eslintDirectory] = process.argv;
    const baseRef = getBaseRef('HEAD', true);
    if (!baseRef) {
        console.error(`No base ref given.`);
        console.error(cannedGithubErrorMessage());
        process.exit(1);
        return;
    }

    const files = await gitChangedFiles(baseRef, workingDirectory || '.');
    const jsFiles = files.filter(file => file.endsWith('.js'));
    if (!jsFiles.length) {
        console.log('No .js files changed');
        return;
    }
    const annotations = eslintAnnotations(eslintDirectory, jsFiles);
    await sendReport(`Eslint${subtitle ? ' - ' + subtitle : ''}`, annotations);
}

// flow-next-uncovered-line
run().catch(err => {
    console.error(err); // flow-uncovered-line
    process.exit(1);
});
