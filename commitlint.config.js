module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf', 'ci', 'revert'],
        ],
        'scope-enum': [
            2,
            'always',
            ['shared', 'bot-runner', 'ai-backend', 'ci', 'docs', 'deps', 'release'],
        ],
        'subject-case': [2, 'always', 'lower-case'],
        'header-max-length': [2, 'always', 100],
    },
};
