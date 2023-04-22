"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const expander_1 = require("./lib/expander");
const extractor_1 = require("./lib/extractor");
const handleExpand = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const document = editor.document;
        const selection = editor.selection;
        const curCursor = selection.active;
        const curLine = document.lineAt(curCursor.line).text;
        const config = vscode.workspace.getConfiguration('mithrilEmmet');
        const { abbr, abbrStart, abbrEnd } = extractor_1.extract(curLine, curCursor.character);
        if (abbr === '') {
            vscode.window.showInformationMessage('[mithril-emmet] Nothing to expand');
            return;
        }
        const expanded = expander_1.expand(abbr, config).trim();
        const TABSTOP = /\${[^{}]+}/g;
        const containsTapstop = TABSTOP.test(expanded);
        if (!containsTapstop) {
            yield editor.edit((edit) => {
                // edit.replace() doesn't work well here, it messes up cursor position/selection
                edit.delete(new vscode.Range(curCursor.line, abbrStart, curCursor.line, abbrEnd));
                edit.insert(new vscode.Position(curCursor.line, abbrStart), expanded);
            });
            const newCursor = selection.active;
            editor.revealRange(new vscode.Range(newCursor.line, abbrStart, newCursor.line, newCursor.character));
        }
        else {
            const supportInsertSnippet = typeof editor.insertSnippet === 'function';
            if (supportInsertSnippet) {
                const snippet = new vscode.SnippetString(expanded);
                yield editor.edit((edit) => {
                    edit.delete(new vscode.Range(curCursor.line, abbrStart, curCursor.line, abbrEnd));
                });
                editor.insertSnippet(snippet, new vscode.Position(curCursor.line, abbrStart));
            }
            else {
                yield editor.edit((edit) => {
                    edit.delete(new vscode.Range(curCursor.line, abbrStart, curCursor.line, abbrEnd));
                    edit.insert(new vscode.Position(curCursor.line, abbrStart), expanded.replace(TABSTOP, ''));
                });
                const cursor = selection.active; // current cursor position after edit
                editor.revealRange(new vscode.Range(curCursor.line, abbrStart, cursor.line, cursor.character));
            }
        }
    }
    catch (e) {
        console.error('[mithril-emmet]', e);
        vscode.window.showErrorMessage('[mithril-emmet] Failed to expand');
    }
});
exports.activate = (context) => {
    context.subscriptions.push(vscode.commands.registerCommand('mithrilEmmet.expand', handleExpand));
};
//# sourceMappingURL=extension.js.map