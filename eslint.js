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

const {spawnSync} = require('child_process');

const gitChangedFiles = require('actions-utils/git-changed-files');
//const getBaseRef = require('actions-utils/get-base-ref');
const {cannedGithubErrorMessage} = require('actions-utils/get-base-ref');
const core = require('@actions/core'); // flow-uncovered-line
const {exec} = require('@actions/exec'); // flow-uncovered-line

const path = require('path');
const chalk = require('chalk');

chalk.enabled = !process.env.GITHUB_TOKEN;

const checkRef = ref => spawnSync('git', ['rev-parse', ref, '--']).status === 0;

const validateBaseRef = (baseRef /*:string*/) /*: string | null */ => {
    
    const {stdout, stderr,error) = spawnSync('git', ['rev-parse', ref, '--'], {stdio: 'inherit'});
    core.info(stdout);
    core.info(stderr);
    core.info(error.message);
    
    // It's locally accessible!
    if (checkRef(baseRef)) {
        return baseRef;
    }
    
    // If it's not locally accessible, then it's probably a remote branch
    const remote = `refs/remotes/origin/${baseRef}`;
    if (checkRef(remote)) {
        return remote;
    }

    // Otherwise return null - no valid ref provided
    return null;
};

const getBaseRef = (head /*:string*/ = 'HEAD') /*: string | null */ => {
    const {GITHUB_BASE_REF} = process.env;
    if (GITHUB_BASE_REF) {
        return validateBaseRef(GITHUB_BASE_REF);
    } else {
        return null;
    }
};

/*::
import type {Message} from 'actions-utils/send-report';
import type {Formatter, LintReport, LintResult} from './types.js';
*/

const eslintAnnotations = async (
    eslintDirectory /*: string */,
    files /*: Array<string> */,
) /*: Promise<Array<Message>> */ => {
    /* flow-uncovered-block */
    // Log which files are being linted.
    const cwd = process.cwd();
    if (files.length === 1 && files[0] === '.') {
        core.info(`Linting all relevant files in ${cwd}`);
    } else {
        core.startGroup('Running eslint on the following files:');
        for (const file of files) {
            core.info(path.relative(cwd, file));
        }
        core.endGroup();
    }

    const args = [
        path.resolve(eslintDirectory, 'bin', 'eslint'),
        '--ext',
        '.js',
        '--ext',
        '.jsx',
        ...files,
    ].filter(Boolean);

    return await exec('node', args, {
        cwd,
    });
};

async function run() {
    const eslintDirectory = core.getInput('eslint-lib', {required: true});
    const workingDirectory = core.getInput('custom-working-directory');
    const runAllIfChanged = core.getMultilineInput('run-all-if-changed');
    if (workingDirectory != null && workingDirectory.trim() !== '') {
        process.chdir(workingDirectory);
    }
    if (!eslintDirectory) {
        /* flow-uncovered-block */
        core.error(
            `You need to have eslint installed, and pass in the directory where it is located via the variable 'eslint-lib'.`,
        );
        /* end flow-uncovered-block */
        process.exit(1);
        return;
    }
    const baseRef = getBaseRef();
    if (!baseRef) {
        core.error(cannedGithubErrorMessage()); // flow-uncovered-line
        process.exit(1);
        return;
    }

    const current = path.resolve('');
    const files = await gitChangedFiles(baseRef, '.');
    const shouldRunAll = runAllIfChanged.some(name =>
        files.some(file => path.relative(current, file) === name),
    );
    const validExt = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];
    const jsFiles = shouldRunAll
        ? // Get all files
          ['.']
        : files.filter(file => validExt.includes(path.extname(file)));

    if (!jsFiles.length) {
        core.info('No JavaScript files changed'); // flow-uncovered-line
        core.info(`Changed files:\n - ${files.join('\n - ')}`); // flow-uncovered-line
        return;
    }
    await eslintAnnotations(eslintDirectory, jsFiles);
}

// flow-next-uncovered-line
run().catch(err => {
    core.setFailed(err); // flow-uncovered-line
    process.exit(1);
});
