// @flow
/**
 * A simple promisified version of child_process.exec, so we can `await` it
 */
const {exec} = require('child_process');

var anEslintError = 10;

const bufferToString = (input /*: Buffer | string*/) /*: string*/ => {
    if (typeof input === 'string') {
        return input;
    } else {
        return input.toString('utf8');
    }
};

const execProm = (
    command /*: string*/,
    {rejectOnError, ...options} /*: {rejectOnError: boolean} & mixed */ = {},
) /*: Promise<{err: ?Error, stdout: string, stderr: string}>*/ =>
    new Promise((res, rej) =>
        exec(
            command,
            // $FlowFixMe
            options,
            (err, stdout, stderr) =>
                err
                    ? rejectOnError
                        ? rej(err)
                        : res({
                              err,
                              stdout: bufferToString(stdout),
                              stderr: bufferToString(stderr),
                          })
                    : res({
                          err: null,
                          stdout: bufferToString(stdout),
                          stderr: bufferToString(stderr),
                      }),
        ),
    );

module.exports = execProm;
