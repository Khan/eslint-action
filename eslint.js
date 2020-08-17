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
//const getBaseRef = require('get-base-ref-temp');
const { execSync, spawnSync } = require('child_process');

const path = require('path');
const chalk = require('chalk');

chalk.enabled = !process.env.GITHUB_TOKEN;

/*::
import type {Message} from 'actions-utils/send-report';
*/

const checkRef = (ref) => spawnSync('git', ['rev-parse', ref]).status === 0;

const validateBaseRef = (baseRef /*:string*/) => {
    // It's locally accessible!

    console.log(`git rev-parse ${baseRef}`);
    console.log(spawnSync('git', ['rev-parse', baseRef]).status);
    if (checkRef(baseRef)) {
        console.log('br checked');
        return baseRef;
    }
    // If it's not locally accessible, then it's probably a remote branch

    const remote = `refs/remotes/origin/${baseRef}`;

    console.log(spawnSync('git', ['rev-parse', remote]).status);

    if (checkRef(remote)) {
        console.log('br remote checked');
        return remote;
    }
    // Otherwise return null - no valid ref provided
    return null;
};

const getBaseRef = (head /*:string*/ = 'HEAD') => {
    const { GITHUB_BASE_REF } = process.env;
    if (GITHUB_BASE_REF) {
        return validateBaseRef(GITHUB_BASE_REF);
    } else {
        let upstream = execSync(
            `git rev-parse --abbrev-ref '${head}@{upstream}'`,
            { encoding: 'utf8' },
        );
        upstream = upstream.trim();

        // if upstream is local and not empty, use that.
        if (upstream && !upstream.trim().startsWith('origin/')) {
            return `refs/heads/${upstream}`;
        }
        let headRef = execSync(`git rev-parse --abbrev-ref ${head}`, {
            encoding: 'utf8',
        });
        headRef = headRef.trim();
        for (let i = 1; i < 100; i++) {
            try {
                const stdout = execSync(
                    `git branch --contains ${head}~${i} --format='%(refname)'`,
                    { encoding: 'utf8' },
                );
                let lines = stdout.split('\n').filter(Boolean);
                lines = lines.filter(
                    (line) => line !== `refs/heads/${headRef}`,
                );

                // Note (Lilli): When running our actions locally, we want to be a little more
                // aggressive in choosing a baseRef, going back to a shared commit on only `develop`,
                // `master`, feature or release branches, so that we can cover more commits. In case,
                // say, I create a bunch of experimental, first-attempt, throw-away branches that
                // share commits higher in my stack...
                for (const line of lines) {
                    if (
                        line === 'refs/heads/develop' ||
                        line === 'refs/heads/master' ||
                        line.startsWith('refs/heads/feature/') ||
                        line.startsWith('refs/heads/release/')
                    ) {
                        return line;
                    }
                }
            } catch {
                // Ran out of history, probably
                return null;
            }
        }
        // We couldn't find it
        return null;
    }
};

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
    if (!eslintDirectory) {
        console.error(
            `You need to have eslint installed, and pass in the directory where it is located via the variable 'eslint-lib'.`,
        );
        process.exit(1);
        return;
    }
    // const [_, __, eslintDirectory] = process.argv;
    const baseRef = getBaseRef();
    if (!baseRef) {
        console.error(`No base ref given`);
        process.exit(1);
        return;
    }
    const files = await gitChangedFiles(baseRef, '.');
    const jsFiles = files.filter(file => file.endsWith('.js'));
    if (!jsFiles.length) {
        console.log('No .js files changed');
        return;
    }
    const annotations = eslintAnnotations(eslintDirectory, jsFiles);
    await sendReport('Eslint', annotations);
}

// flow-next-uncovered-line
run().catch(err => {
    console.error(err); // flow-uncovered-line
    process.exit(1);
});
