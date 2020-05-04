// @flow
const execProm = require('./exec-prom');
const path = require('path');
const fs = require('fs');

/**
 * This lists the files that have changed when compared to `base` (a git ref),
 * limited to the files that are a descendent of `cwd`.
 */
const gitChangedFiles = async (
    base /*:string*/,
    cwd /*:string*/,
) /*: Promise<Array<string>>*/ => {
    cwd = path.resolve(cwd);
    const { stdout } = await execProm(
        `git diff --name-only ${base} --relative`,
        { cwd, encoding: 'utf8', rejectOnError: true },
    );
    return (
        stdout
            .split('\n')
            .filter(Boolean)
            .map((name) => path.join(cwd, name))
            // Filter out paths that were deleted
            .filter((path) => fs.existsSync(path))
    );
};

module.exports = gitChangedFiles;
