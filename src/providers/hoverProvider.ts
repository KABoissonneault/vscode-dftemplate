/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../language/parser';

import { Types } from '../language/parser';
import { HoverProvider, Hover, TextDocument, Position, MarkdownString } from 'vscode';
import { EOL } from 'os';
import { Modules } from '../language/modules';
import { Language } from '../language/language';

class TemplateDocumentationParameter {
    public name = '';
    public description = '';
}

class TemplateDocumentationItem {
    public category = '';
    public signature = '';
    public summary = '';
    public parameters: TemplateDocumentationParameter[] = [];
}

export class TemplateHoverProvider implements HoverProvider {

    public provideHover(document: TextDocument, position: Position): Thenable<Hover> {     
        let instance:TemplateHoverProvider = this;
        return new Promise(function (resolve, reject) {
            let word = parser.getWord(document, position);
            if (word) {
                // If is a symbol, show description according to prefix.
                if (parser.isSymbol(word)) {
                    let definition = parser.findSymbolDefinition(document, word);
                    if (definition) {
                        let item = new TemplateDocumentationItem();
                        item.category = 'symbol';
                        item.signature = document.lineAt(definition.location.range.start.line).text;
                        item.summary = TemplateHoverProvider.getSymbolDescription(word, definition.type);
                        return resolve(TemplateHoverProvider.makeHover(item));
                    }

                    const taskLine = parser.findTaskDefinition(document, word);
                    if (taskLine) {
                        const item = new TemplateDocumentationItem();
                        item.category = 'task';
                        item.signature = taskLine.text.trim();
                        item.summary = parser.makeSummary(document, taskLine.lineNumber);
                        return resolve(TemplateHoverProvider.makeHover(item));
                    }
                }

                // Seek message from number
                if (!isNaN(Number(word))) {           
                    let messageDefinition = parser.findMessageByIndex(document, word);
                    if (messageDefinition) {
                        let line = messageDefinition.line;
                        if (messageDefinition.isDefault) {
                            return resolve(instance.provideHover(document, new Position(line.lineNumber, 0)));
                        }
                        else {
                            let item = new TemplateDocumentationItem();
                            item.category = 'message';
                            item.signature = line.text;
                            const summary = parser.makeSummary(document, line.lineNumber);
                            if (summary) {
                                item.summary = summary;
                            }
                            return resolve(TemplateHoverProvider.makeHover(item));
                        }
                    }
                }

                // Seek word in documentation files
                const definition = Language.getInstance().findDefinition(word, document.lineAt(position.line).text);
                if (definition) {
                    const item = new TemplateDocumentationItem();
                    item.category = 'definition';
                    item.signature = definition.signature;
                    const overloads = Language.getInstance().numberOfOverloads(word) - 1;
                    if (overloads > 0) {
                        item.signature += ' (+' + overloads + ' overloads)';
                    }
                    item.summary = definition.summary;
                    item.parameters = definition.parameters;
                    return resolve(TemplateHoverProvider.makeHover(item));
                }
                const languageItem = Language.getInstance().seekByName(word);
                if (languageItem) {
                    languageItem.signature = Language.prettySignature(languageItem.signature);
                    return resolve(TemplateHoverProvider.makeHover(languageItem));
                }

                // Seek quest
                if (parser.isQuestReference(document.lineAt(position.line).text)) {
                    return parser.findQuestDefinition(word).then((quest) => {
                        let item = new TemplateDocumentationItem();
                        item.category = 'quest';
                        item.signature = 'Quest: ' +  quest.pattern;
                        item.summary = quest.displayName;
                        return resolve(TemplateHoverProvider.makeHover(item));
                    }, () => reject());
                }

                // Actions
                let result = Modules.getInstance().findAction(word, document.lineAt(position.line).text);
                if (result) {
                    let item = new TemplateDocumentationItem();
                    item.category = result.actionKind;
                    let signature = result.moduleName + ' -> ' + result.action.overloads[result.overload];
                    if (result.action.overloads.length > 1) {
                        signature += '\n\nother overload(s):';
                        for (let i = 0; i < result.action.overloads.length; i++) {
                            if (i !== result.overload) {
                                signature += '\n' + result.action.overloads[i];
                            }
                        }
                    }
                    item.signature = Modules.prettySignature(signature);
                    item.summary = result.action.summary;
                    return resolve(TemplateHoverProvider.makeHover(item));
                }
            }

            return reject();
        });
    }

    /**
     * Make a formatted markdown for the given documentation item.
     */
    private static makeHover(item: TemplateDocumentationItem): Hover {
        let hovertext: MarkdownString[] = [];

        if (item.signature) {
            let signature = new MarkdownString();
            let signatureText = item.category ? '(' + item.category + ') ' + item.signature : item.signature;
            hovertext.push(signature.appendMarkdown(['```dftemplate', signatureText, '```', ''].join(EOL)));
        }

        if (item.summary) {
            let summary = new MarkdownString();
            hovertext.push(summary.appendMarkdown(item.summary));
        }

        if (item.parameters) {
            let parameters: string[] = [];
            item.parameters.forEach(parameter => {
                parameters.push('*@param* `' + parameter.name + '` - ' + parameter.description);
            });
            hovertext.push(new MarkdownString(parameters.join('\n\n')));
        }

        return new Hover(hovertext);
    }

    /**
     * Get a description for symbol according to prefix and type.
     */
    private static getSymbolDescription(symbol: string, type: string): string {
        if (symbol[0] === '_') {
            if (symbol.length > 1 && symbol[1] === '_') {
                if (symbol.length > 2 && symbol[2] === '_') {
                    if (symbol.length > 3 && symbol[3] === '_') {
                        if (type === Types.Place) {
                            return 'the name of the province where ' + this.formatSymbol(symbol, 3) + ' can be found.';
                        }
                    }
                    else {
                        if (type === Types.Place) {
                            return 'the dungeon name of ' + this.formatSymbol(symbol, 2) + '.';
                        }
                        else if (type === Types.Person) {
                            return 'the town name where ' + this.formatSymbol(symbol, 2) + ' can be found.';
                        }
                    }
                }
                else {
                    if (type === Types.Place) {
                        return 'the town where the shop ' + this.formatSymbol(symbol, 1) + ' can be found.';
                    }
                    else if (type === Types.Person) {
                        return 'the name of the house/shop in the town where ' + this.formatSymbol(symbol, 1) + ' can be found.';
                    }
                }
            }
            else {
                if (type === Types.Place) {
                    return 'the name of the shop ' + this.formatSymbol(symbol, 0) + '.';
                }
                else if (type === Types.Item || type === Types.Person || type === Types.Foe) {
                    return 'the name of ' + this.formatSymbol(symbol, 0) + '.';
                }
                else if (type === Types.Clock) {
                    return 'base definition of ' + this.formatSymbol(symbol, 0) + ' (use `=' + parser.getSymbolName(symbol) + '_` to get the clock time).';
                }
            }
        }
        else if (symbol[0] === '=') {
            if (symbol.length > 1 && symbol[1] === '=') {
                if (type === Types.Person || type === Types.Foe) {
                    return 'The faction association of ' + this.formatSymbol(symbol, 1) + '.';
                }
            }
            else {
                if (type === Types.Person) {
                    return 'character class of ' + this.formatSymbol(symbol, 0);
                }
                else if (type === Types.Foe) {
                    return this.formatSymbol(symbol, 0) + "'s name.";
                }
                else if (type === Types.Clock) {
                    return 'the number of days ' + this.formatSymbol(symbol, 0) + ' will be active.';
                }
            }
        }

        return 'undefined value for the type `' + type + '`.';
    }

    /**
     * MarkDown format a symbol name from one of its derived form.
     * 
     * @param derived derived form of symbol
     * @param leftIndex index of char on the left of symbol name (nearest _ or =).
     */
    private static formatSymbol(derived: string, leftIndex: number): string {
        return '`' + derived.substring(leftIndex + 1, derived.length - 1) + '`';
    }
}