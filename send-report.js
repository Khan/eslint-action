// @flow

/**
 * The goal of this "action runner" is to allow running "locally"
 * or in a github action.
 *
 * Local running writes to stdout
 * Github running creates a github check.
 *
 * And we distinguish between the two by the presence or absence of
 * the GITHUB_TOKEN env variable.
 */

const {GITHUB_TOKEN, GITHUB_WORKSPACE} = process.env;
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
/* flow-uncovered-block */
const highlight /*: (string, {language: string, ignoreIllegals: boolean}) => string */ = require('cli-highlight')
    .highlight;
/* end flow-uncovered-block */

/*::
export type Message = {
    message: string,
    start: {line: number, column: number},
    end: {line: number, column: number},
    annotationLevel: 'failure' | 'warning',
    path: string,
}
*/

/**
 * Report out these error messages locally, by printing to stderr.
 */
const localReport = async (title /*:string*/, messages /*:Array<Message>*/) => {
    console.log();
    console.log(chalk.yellow(`[[ ${title} ]]`));
    console.log();
    const fileCache /*: {[key: string]: Array<string>}*/ = {};
    const getFile = filePath => {
        if (!fileCache[filePath]) {
            const ext = path.extname(filePath).slice(1);
            fileCache[filePath] = highlight(fs.readFileSync(filePath, 'utf8'), {
                language: ext,
                ignoreIllegals: true,
            }).split('\n');
        }
        return fileCache[filePath];
    };
    const byFile /*:{[key: string]: number}*/ = {};
    messages.forEach(message => {
        const lines = getFile(message.path);
        const lineStart = Math.max(message.start.line - 3, 0);
        const indexStart = lineStart + 1;
        const context = lines.slice(lineStart, message.end.line + 2);
        if (!byFile[message.path]) {
            byFile[message.path] = 1;
        } else {
            byFile[message.path] += 1;
        }
        console.error(
            ':error:',
            chalk.cyan(
                `${message.path}:${message.start.line}:${message.start.column}`,
            ),
        );
        console.error(message.message);
        console.error(
            '\n' +
                context
                    .map(
                        (line, i) =>
                            `${chalk.dim(indexStart + i + ':')}${
                                indexStart + i >= message.start.line &&
                                indexStart + i <= message.end.line
                                    ? chalk.red('>')
                                    : ' '
                            } ${line}`,
                    )
                    .join('\n') +
                '\n',
        );
    });
    const files = Object.keys(byFile);
    if (files.length > 1) {
        console.error(chalk.yellow(`Issues by file`));
        console.error();
        for (const file of files) {
            console.error(`${byFile[file]} in ${chalk.cyan(file)}`);
        }
    }

    console.error(chalk.yellow(`${messages.length} total issues for ${title}`));
};

const removeWorkspace = (path /*: string*/) => {
    // To appease flow
    if (!GITHUB_WORKSPACE) {
        return path;
    }
    if (path.startsWith(GITHUB_WORKSPACE)) {
        return path.substring(GITHUB_WORKSPACE.length + 1);
    }
    return path;
};

/**
 * Report out these errors to github, by making a new "check" and uploading
 * the messages as annotations.
 */
const githubReport = async (
    title /*: string*/,
    token /*: string*/,
    messages /*: Array<Message>*/,
) => {
    /* flow-uncovered-block */
    const {GitHub, context} = require('@actions/github');
    const {owner, repo} /*: {owner: string, repo: string}*/ = context.repo;
    const client = new GitHub(token, {});
    const headSha = context.payload.pull_request.head.sha;
    const check = await client.checks.create({
        owner,
        repo,
        started_at: new Date(),
        name: title,
        head_sha: headSha,
    });
    /* end flow-uncovered-block */
    const annotations = messages.map(message => ({
        path: removeWorkspace(message.path),
        start_line: message.start.line,
        end_line: message.end.line,
        annotation_level: message.annotationLevel,
        message: message.message,
    }));
    let errorCount = 0;
    let warningCount = 0;
    messages.forEach(message => {
        if (message.annotationLevel === 'failure') {
            errorCount += 1;
        } else {
            warningCount += 1;
        }
    });

    // The github checks api has a limit of 50 annotations per call
    // (https://developer.github.com/v3/checks/runs/#output-object)
    while (annotations.length > 0) {
        // take the first 50, removing them from the list
        const subset = annotations.splice(0, 50);
        /* flow-uncovered-block */
        await client.checks.update({
            owner,
            repo,
            check_run_id: check.data.id,
            completed_at: new Date(),
            status: 'completed',
            conclusion: errorCount > 0 ? 'failure' : 'success',
            output: {
                title: title,
                summary: `${errorCount} error(s), ${warningCount} warning(s) found`,
                annotations: subset,
            },
        });
        /* end flow-uncovered-block */
    }
};

const makeReport = (title /*: string*/, messages /*: Array<Message>*/) => {
    if (!messages.length) {
        console.log(`${title}: No errors`);
        return;
    }
    if (GITHUB_TOKEN) {
        return githubReport(title, GITHUB_TOKEN, messages);
    } else {
        return localReport(title, messages);
    }
};

module.exports = makeReport;
