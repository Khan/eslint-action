// @flow

type Fix = {
    range: [number, number],
    text: string,
};

type LintSuggestion = {
    desc: string,
    fix: Fix,
    messageId?: string,
};

type Severity = 0 | 1 | 2;

type LintMessage = {
    column: number,
    line: number,
    endColumn?: number,
    endLine?: number,
    ruleId: string | null,
    message: string,
    messageId?: string,
    nodeType?: string,
    fatal?: true,
    severity: Severity,
    fix?: Fix,
    /** @deprecated Use `linter.getSourceCode()` */
    source?: string | null,
    suggestions?: Array<LintSuggestion>,
};

type DeprecatedRuleUse = {
    ruleId: string,
    replacedBy: string[],
};

export type LintResult = {
    filePath: string,
    messages: Array<LintMessage>,
    errorCount: number,
    warningCount: number,
    fixableErrorCount: number,
    fixableWarningCount: number,
    output?: string,
    source?: string,
    usedDeprecatedRules: Array<DeprecatedRuleUse>,
};

export type LintReport = {
    results: Array<LintResult>,
    errorCount: number,
    warningCount: number,
    fixableErrorCount: number,
    fixableWarningCount: number,
    usedDeprecatedRules: Array<DeprecatedRuleUse>,
};

export type Formatter = {
    format(results: Array<LintResult>): string,
};
