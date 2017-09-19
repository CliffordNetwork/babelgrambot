DROP TABLE autotranslate;

CREATE TABLE autotranslate (
    groupId bigint,
    userId bigint,
    userName text,
    firstName text,
    lastName text,
    fromLanguageCode text,
    toLanguageCode text
);