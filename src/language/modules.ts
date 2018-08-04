/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { ExtensionContext } from 'vscode';
import { TablesManager } from './base/tablesManager';
import { BooleanExpression } from './booleanExpression';
import { getOptions } from '../extension';

interface Action {
    summary: string;
    overloads: string[];
}

export interface ActionResult {
    moduleName: string;
    actionKind: string;
    action: Action;
    overload: number;
}

export interface Module {
    displayName: string;
    conditions: Action[];
    actions: Action[];
}

/**
 * Manage imported modules for intellisense.
 */
export class Modules extends TablesManager {

    private modules: Module[] = [];

    private static instance: Modules | null;

    public static readonly ActionKind = {
        Condition: 'condition',
        Action: 'action'
    };

    /**
     * Load all enabled modules.
     * @param context Current context of extension.
     */
    public load(context: ExtensionContext): Promise<void> {
        var instance = this;
        return new Promise((resolve) => {
            Modules.loadModules(getOptions()['modules'], context).then((modules) => {
                instance.modules = modules;
                return resolve();
            }, () => vscode.window.showErrorMessage('Failed to import modules.'));
        });
    }

    /**
     * Find the action referenced in a line of a task.
     * @param prefix Trigger word.
     * @param text All text that contains a call to action.
     */
    public findAction(prefix: string, text: string): ActionResult | undefined {
        for (const result of this.findActions(prefix)) {
            for (let i = 0; i < result.action.overloads.length; i++) {
                if (text.match(Modules.makeRegexFromSignature(result.action.overloads[i]))) {
                    result.overload = i;
                    return result;
                }
            }
        }
        if (BooleanExpression.match(prefix, text)) {
            return BooleanExpression.makeResult(text);
        }
    }

    /**
     * Find all actions that start with the given string.
     * @param prefix Start of signature.
     */
    public *findActions(prefix: string): Iterable<ActionResult> {
        for (const module of this.modules) {
            if (module.conditions) {
                for (const condition of Modules.filterActions(module.conditions, prefix)) {
                    yield { moduleName: module.displayName, actionKind: Modules.ActionKind.Condition, action: condition, overload: 0 };
                }
            }
            if (module.actions) {
                for (const action of Modules.filterActions(module.actions, prefix)) {
                    yield { moduleName: module.displayName, actionKind: Modules.ActionKind.Action, action: action, overload: 0 };
                }
            }
        }
    }

    /**
     * Find action or condition invoked in a line of a task.
     * @param text A line of a task.
     */
    public findInvokedAction(text: string): ActionResult | undefined {
        const match = /^\s*([a-zA-Z]+)\s/.exec(text);
        if (match) {
            return this.findAction(match[1], text);
        }
    }

    public static getInstance(): Modules {
        return Modules.instance ? Modules.instance : Modules.instance = new Modules();
    }

    public static release() {
        Modules.instance = null;
    }

    private static loadModules(paths: string[], context: ExtensionContext): Thenable<Module[]> {
        var modules = [];
        for (const path of paths) {
            modules.push(Modules.loadModule(path, context));
        }
        return Promise.all(modules);
    }

    private static loadModule(path: string, context: ExtensionContext): Thenable<Module> {
        path = path.replace('${extensionPath}', context.extensionPath);
        if (vscode.workspace.workspaceFolders) {
            path = path.replace('${workspaceFolder}', vscode.workspace.workspaceFolders[0].uri.fsPath);
        }

        return Modules.parseFromJson(path).then((obj) => {
            return obj;
        }, () => vscode.window.showErrorMessage('Failed to import module ' + path + '.'));
    }

    private static *filterActions(actions: Action[], prefix: string) {
        for (const action of actions) {
            if (action.overloads[0].startsWith(prefix)) {
                yield action;
            }
        }
    }
}