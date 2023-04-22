"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Manager = void 0;
const dispose_1 = require("./utils/dispose");
const vscode = require("vscode");
const pathUtil_1 = require("./utils/pathUtil");
const connectionManager_1 = require("./connectionInfo/connectionManager");
const browserPreview_1 = require("./editorPreview/browserPreview");
const settingsUtil_1 = require("./utils/settingsUtil");
const nls = require("vscode-nls");
const serverTaskProvider_1 = require("./task/serverTaskProvider");
const endpointManager_1 = require("./infoManagers/endpointManager");
const previewManager_1 = require("./editorPreview/previewManager");
const fs_1 = require("fs");
const statusBarNotifier_1 = require("./server/serverUtils/statusBarNotifier");
const constants_1 = require("./utils/constants");
const serverGrouping_1 = require("./server/serverGrouping");
const updateListener_1 = require("./updateListener");
const url_1 = require("url");
const localize = nls.loadMessageBundle();
/**
 * This object re-serializes the webview after a reload
 */
class PanelSerializer extends dispose_1.Disposable {
    constructor() {
        super(...arguments);
        this._onShouldRevive = this._register(new vscode.EventEmitter());
        this.onShouldRevive = this._onShouldRevive.event;
    }
    deserializeWebviewPanel(webviewPanel, state) {
        // fire event to parent, since all info needed to re-open a panel is in the parent
        this._onShouldRevive.fire({ webviewPanel, state });
        return Promise.resolve();
    }
}
/**
 * `Manager` is a singleton instance that managers all of the servers, the previews, connection info, etc.
 * It also facilitates opening files (sometimes by calling `PreviewManager`) and starting the associated servers.
 */
class Manager extends dispose_1.Disposable {
    constructor(_extensionUri, _reporter, _userDataDir) {
        super();
        this._extensionUri = _extensionUri;
        this._reporter = _reporter;
        this._serverGroupings = new Map();
        this._pendingServerWorkspaces = new Set();
        this._connectionManager = this._register(new connectionManager_1.ConnectionManager());
        this._register(this._connectionManager.onConnected((e) => {
            var _a;
            this._statusBar.setServer((_a = e.workspace) === null || _a === void 0 ? void 0 : _a.uri, e.httpPort);
            vscode.commands.executeCommand('setContext', constants_1.LIVE_PREVIEW_SERVER_ON, true);
        }));
        this._endpointManager = this._register(new endpointManager_1.EndpointManager());
        this._previewManager = this._register(new previewManager_1.PreviewManager(this._extensionUri, this._reporter, this._connectionManager, this._endpointManager, () => {
            var _a;
            if (this._hasServerRunning() &&
                !this._serverTaskProvider.isRunning &&
                vscode.workspace.workspaceFolders &&
                ((_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a.length) > 0 &&
                this._serverTaskProvider.runTaskWithExternalPreview) {
                this.closeAllServers();
            }
        }));
        this._statusBar = this._register(new statusBarNotifier_1.StatusBarNotifier());
        this._serverTaskProvider = this._register(new serverTaskProvider_1.ServerTaskProvider(this._reporter, this._endpointManager, this._connectionManager));
        this._register(vscode.tasks.registerTaskProvider(serverTaskProvider_1.ServerTaskProvider.CustomBuildScriptType, this._serverTaskProvider));
        this._register(this._serverTaskProvider.onRequestOpenEditorToSide((uri) => {
            var _a;
            if (this._previewManager.previewActive &&
                this._previewManager.currentPanel) {
                const avoidColumn = (_a = this._previewManager.currentPanel.panel.viewColumn) !== null && _a !== void 0 ? _a : vscode.ViewColumn.One;
                const column = avoidColumn == vscode.ViewColumn.One
                    ? avoidColumn + 1
                    : avoidColumn - 1;
                vscode.commands.executeCommand('vscode.open', uri, {
                    viewColumn: column,
                });
            }
            else {
                vscode.commands.executeCommand('vscode.open', uri);
            }
        }));
        this._register(this._serverTaskProvider.onRequestToOpenServer(async (workspace) => {
            const serverGrouping = this._getServerGroupingFromWorkspace(workspace);
            // running this with `fromTask = true` will still inform the task if the server is already open
            await serverGrouping.openServer(true);
        }));
        this._register(this._serverTaskProvider.onRequestToCloseServer((workspace) => {
            if (this._previewManager.previewActive) {
                this._serverTaskProvider.serverStop(false, workspace);
            }
            else {
                const serverGrouping = this._serverGroupings.get(workspace === null || workspace === void 0 ? void 0 : workspace.uri.toString());
                // closeServer will call `this._serverTaskProvider.serverStop(true, workspace);`
                serverGrouping === null || serverGrouping === void 0 ? void 0 : serverGrouping.dispose();
            }
        }));
        const serializer = this._register(new PanelSerializer());
        this._register(serializer.onShouldRevive((e) => {
            var _a;
            let relative = false;
            let file = (_a = e.state.currentAddress) !== null && _a !== void 0 ? _a : '/';
            let workspace = pathUtil_1.PathUtil.PathExistsRelativeToAnyWorkspace(file);
            if (workspace) {
                relative = true;
            }
            else {
                // path isn't relative to workspaces, try checking absolute path for workspace
                workspace = pathUtil_1.PathUtil.AbsPathInAnyWorkspace(file);
            }
            if (!workspace) {
                // no workspace; try to decode endpoint to fix file
                const potentialFile = this._endpointManager.decodeLooseFileEndpoint(file);
                if (potentialFile) {
                    file = potentialFile;
                }
                else {
                    e.webviewPanel.dispose();
                    return;
                }
            }
            let fileUri;
            // loose file workspace will be fetched if workspace is still undefined
            const grouping = this._getServerGroupingFromWorkspace(workspace);
            if (workspace) {
                fileUri = vscode.Uri.joinPath(workspace.uri, file);
            }
            else {
                fileUri = vscode.Uri.parse(file);
            }
            grouping.createOrShowEmbeddedPreview(e.webviewPanel, fileUri, relative);
            e.webviewPanel.webview.options =
                this._previewManager.getWebviewOptions();
        }));
        if (vscode.window.registerWebviewPanelSerializer) {
            this._register(vscode.window.registerWebviewPanelSerializer(browserPreview_1.BrowserPreview.viewType, serializer));
        }
        this._register(vscode.workspace.onDidChangeWorkspaceFolders((e) => {
            if (e.removed) {
                e.removed.forEach((workspace) => {
                    const potentialGrouping = this._serverGroupings.get(workspace.uri.toString());
                    if (potentialGrouping) {
                        potentialGrouping.dispose();
                    }
                });
            }
            // known bug: transitioning between 1 and 2 workspaces: https://github.com/microsoft/vscode/issues/128138
        }));
        this._register(this._serverTaskProvider.onShouldLaunchPreview((e) => {
            if (e.uri && e.uri.scheme !== 'file') {
                this.openPreviewAtLink(e.uri, e.previewType);
            }
            else {
                this.openPreviewAtFileUri(e.uri, e.options, e.previewType);
            }
        }));
        this._register(this._previewManager.onShouldLaunchPreview((e) => {
            if (e.uri && e.uri.scheme !== 'file') {
                this.openPreviewAtLink(e.uri, e.previewType);
            }
            else {
                this.openPreviewAtFileUri(e.uri, e.options, e.previewType);
            }
        }));
        this._updateListener = this._register(new updateListener_1.UpdateListener(_userDataDir));
        this._register(this._updateListener.shouldRefreshPreviews(() => this._refreshBrowsers()));
    }
    /**
     * handles opening a file
     * @param internal whether to launch an embedded preview
     * @param file the uri or string filePath to use
     * @param fileStringRelative whether the path is relative
     * @param debug whether to launch in debug
     * @param workspace the workspace to launch the file from
     * @param port the port to derive the workspace from
     * @param serverGrouping the serverGrouping that manages the server workspace
     */
    async handleOpenFile(internal, debug, file, workspace, port, serverGrouping) {
        if (file.scheme !== 'file') {
            console.error('Tried to open a non-file URI with file opener');
        }
        if (!serverGrouping) {
            if (workspace) {
                serverGrouping = this._getServerGroupingFromWorkspace(workspace);
            }
            else if (port) {
                this._serverGroupings.forEach((potentialServerGrouping) => {
                    if (potentialServerGrouping.port === port) {
                        serverGrouping = potentialServerGrouping;
                        return;
                    }
                });
            }
            else {
                workspace = vscode.workspace.getWorkspaceFolder(file);
                serverGrouping = this._getServerGroupingFromWorkspace(workspace);
            }
        }
        if (!serverGrouping) {
            // last-resort: use loose workspace server.
            serverGrouping = this._getServerGroupingFromWorkspace(undefined);
        }
        return this._openPreview(internal, serverGrouping, file, debug);
    }
    /**
     * Show the picker to select a server to close
     */
    async showCloseServerPicker() {
        const disposables = [];
        const quickPick = vscode.window.createQuickPick();
        disposables.push(quickPick);
        quickPick.matchOnDescription = true;
        quickPick.placeholder = localize('selectPort', 'Select the port that corresponds to the server that you want to stop');
        quickPick.items = await this._getServerPicks();
        disposables.push(quickPick.onDidAccept(() => {
            const selectedItem = quickPick.selectedItems[0];
            selectedItem.accept();
            quickPick.hide();
            disposables.forEach((d) => d.dispose());
        }));
        quickPick.show();
    }
    /**
     * Close all servers
     */
    closeAllServers() {
        this._serverGroupings.forEach((serverGrouping) => {
            serverGrouping.dispose();
        });
    }
    dispose() {
        this.closeAllServers();
        super.dispose();
    }
    closePanel() {
        var _a;
        (_a = this._previewManager.currentPanel) === null || _a === void 0 ? void 0 : _a.close();
    }
    /**
     * Using only a string path (unknown if relative or absolute), launch the preview or launch an error.
     * This is usually used for when the user configures a setting for initial filepath
     * @param filePath the string fsPath to use
     */
    openPreviewAtFileString(filePath) {
        if (filePath === '') {
            this._openPreviewWithNoTarget();
            return;
        }
        // let foundPath = false;
        const workspace = pathUtil_1.PathUtil.PathExistsRelativeToAnyWorkspace(filePath);
        if (workspace) {
            const file = vscode.Uri.joinPath(workspace.uri, filePath);
            this.openPreviewAtFileUri(file, {
                workspace: workspace,
            });
        }
        if ((0, fs_1.existsSync)(filePath)) {
            const file = vscode.Uri.file(filePath);
            this.openPreviewAtFileUri(file);
        }
        else {
            vscode.window.showWarningMessage(localize('fileDNE', "The file '{0}' does not exist.", filePath));
            this.openPreviewAtFileUri(undefined);
        }
    }
    /**
     * Runs task for workspace from within extension. Must have at least one workspace open.
     * @param file optional file to use to find the workspace to run the task out of.
     * @returns
     */
    async runTaskForFile(file) {
        var _a, _b, _c;
        if (!file) {
            file = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.uri;
        }
        let workspace;
        if (file) {
            workspace = vscode.workspace.getWorkspaceFolder(file);
        }
        else if (vscode.workspace.workspaceFolders &&
            ((_b = vscode.workspace.workspaceFolders) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            if (this._serverGroupings.size > 0) {
                const matchGrouping = Array.from(this._serverGroupings.values()).find((grouping) => grouping.workspace && grouping.isRunning);
                workspace =
                    (_c = matchGrouping === null || matchGrouping === void 0 ? void 0 : matchGrouping.workspace) !== null && _c !== void 0 ? _c : vscode.workspace.workspaceFolders[0];
            }
            else {
                workspace = vscode.workspace.workspaceFolders[0];
            }
        }
        if (!workspace) {
            return; // fails preconditions of being in a workspace
        }
        return await this._serverTaskProvider.extRunTask(workspace);
    }
    /**
     * Opens a preview at an internal link that has the format <scheme>://<host>:<port>/<path>
     * @param link
     * @param previewType
     */
    async openPreviewAtLink(link, previewType) {
        const debug = previewType === settingsUtil_1.PreviewType.externalDebugPreview;
        const internal = this._isInternalPreview(previewType);
        try {
            if (link.scheme !== 'https' && link.scheme !== 'http') {
                console.error(`${link.scheme} does not correspond to a link URI`);
                throw Error;
            }
            const pathStr = `${link.scheme}://${link.authority}`;
            const url = new url_1.URL(pathStr);
            const port = parseInt(url.port);
            const connection = this._connectionManager.getConnectionFromPort(port);
            if (!connection) {
                console.error(`There is no server from Live Preview on port ${port}.`);
                throw Error;
            }
            const serverGrouping = this._getServerGroupingFromWorkspace(connection.workspace);
            if (!connection.workspace) {
                return this._openPreview(internal, serverGrouping, vscode.Uri.file(link.path), debug);
            }
            const file = vscode.Uri.joinPath(connection.workspace.uri, link.path);
            this._openPreview(internal, serverGrouping, file, debug);
        }
        catch (e) {
            vscode.window.showErrorMessage(localize('badURL', 'Tried to open preview on invalid URI'));
        }
    }
    async openPreviewAtFileUri(file, options, previewType) {
        var _a, _b;
        let fileUri;
        if (!file) {
            if ((_a = this._previewManager.currentPanel) === null || _a === void 0 ? void 0 : _a.panel.active) {
                if (this._previewManager.currentPanel.currentConnection.workspace) {
                    fileUri = vscode.Uri.joinPath(this._previewManager.currentPanel.currentConnection.workspace.uri, this._previewManager.currentPanel.currentAddress);
                }
                else {
                    fileUri = vscode.Uri.parse(this._previewManager.currentPanel.currentAddress);
                }
            }
            else {
                const activeFile = (_b = vscode.window.activeTextEditor) === null || _b === void 0 ? void 0 : _b.document.uri;
                if (activeFile) {
                    fileUri = activeFile;
                }
                else {
                    return this._openPreviewWithNoTarget();
                }
            }
        }
        else {
            fileUri = file;
        }
        if (!previewType) {
            previewType = settingsUtil_1.SettingUtil.GetPreviewType();
        }
        const internal = previewType === settingsUtil_1.PreviewType.internalPreview;
        const debug = previewType === settingsUtil_1.PreviewType.externalDebugPreview;
        return this.handleOpenFile(internal, debug, fileUri, options === null || options === void 0 ? void 0 : options.workspace, options === null || options === void 0 ? void 0 : options.port, options === null || options === void 0 ? void 0 : options.manager);
    }
    _refreshBrowsers() {
        Array.from(this._serverGroupings.values()).forEach((grouping) => {
            grouping.refresh();
        });
    }
    /**
     * Creates a serverGrouping and connection object for a workspace if it doesn't already have an existing one.
     * Otherwise, return the existing serverGrouping.
     * @param workspace
     * @returns serverGrouping for this workspace (or, when `workspace == undefined`, the serverGrouping for the loose file workspace)
     */
    _getServerGroupingFromWorkspace(workspace) {
        let serverGrouping = this._serverGroupings.get(workspace === null || workspace === void 0 ? void 0 : workspace.uri.toString());
        if (!serverGrouping) {
            const connection = this._connectionManager.createAndAddNewConnection(workspace);
            this._register(connection.onConnected(() => {
                this._pendingServerWorkspaces.delete(workspace === null || workspace === void 0 ? void 0 : workspace.uri.toString());
            }));
            serverGrouping = this._register(new serverGrouping_1.ServerGrouping(this._extensionUri, this._reporter, this._endpointManager, connection, this._serverTaskProvider, this._pendingServerWorkspaces));
            this._register(serverGrouping.onClose(() => {
                var _a;
                if (this._previewManager.currentPanel &&
                    this._previewManager.currentPanel.currentConnection === connection) {
                    // close the preview if it is showing this server's content
                    (_a = this._previewManager.currentPanel) === null || _a === void 0 ? void 0 : _a.close();
                }
                this._statusBar.removeServer(workspace === null || workspace === void 0 ? void 0 : workspace.uri);
                this._serverGroupings.delete(workspace === null || workspace === void 0 ? void 0 : workspace.uri.toString());
                if (this._serverGroupings.size === 0) {
                    this._statusBar.serverOff();
                    vscode.commands.executeCommand('setContext', constants_1.LIVE_PREVIEW_SERVER_ON, false);
                }
                this._connectionManager.removeConnection(workspace);
            }));
            this._register(serverGrouping.onShouldLaunchEmbeddedPreview((e) => this._previewManager.launchFileInEmbeddedPreview(e.panel, e.connection, e.uri)));
            this._register(serverGrouping.onShouldLaunchExternalPreview((e) => this._previewManager.launchFileInExternalBrowser(e.debug, e.connection, e.uri)));
            this._serverGroupings.set(workspace === null || workspace === void 0 ? void 0 : workspace.uri.toString(), serverGrouping);
        }
        return serverGrouping;
    }
    async _openPreview(internal, serverGrouping, file, debug = false) {
        if (internal) {
            // for now, ignore debug or no debug for embedded preview
            await serverGrouping.createOrShowEmbeddedPreview(undefined, file);
        }
        else {
            await serverGrouping.showPreviewInBrowser(debug, file);
        }
    }
    _hasServerRunning() {
        const isRunning = Array.from(this._serverGroupings.values()).filter((group) => group.running);
        return isRunning.length !== 0;
    }
    _isInternalPreview(previewType) {
        if (!previewType) {
            previewType = settingsUtil_1.SettingUtil.GetPreviewType();
        }
        return previewType === settingsUtil_1.PreviewType.internalPreview;
    }
    _openPreviewWithNoTarget() {
        // opens index at first open server or opens a loose workspace at root
        const internal = this._isInternalPreview();
        const workspaces = vscode.workspace.workspaceFolders;
        if (workspaces && workspaces.length > 0) {
            for (let i = 0; i < workspaces.length; i++) {
                const currWorkspace = workspaces[i];
                const manager = this._serverGroupings.get(currWorkspace.uri.toString());
                if (manager) {
                    this.openPreviewAtFileUri(undefined, {
                        workspace: currWorkspace,
                        manager: manager,
                    });
                    return;
                }
            }
            const grouping = this._getServerGroupingFromWorkspace(workspaces[0]);
            this._openPreview(internal, grouping, undefined);
        }
        else {
            const grouping = this._getServerGroupingFromWorkspace(undefined);
            this._openPreview(internal, grouping, undefined);
        }
    }
    async _getServerPicks() {
        const serverPicks = [];
        const picks = await Promise.all(Array.from(this._serverGroupings.values()).map((grouping) => this._getServerPickFromGrouping(grouping)));
        picks.forEach((pick) => {
            if (pick) {
                serverPicks.push(pick);
            }
        });
        if (picks.length > 0) {
            serverPicks.push({
                label: localize('allServers', 'All Servers'),
                accept: () => this.closeAllServers(),
            });
        }
        return serverPicks;
    }
    _getServerPickFromGrouping(grouping) {
        var _a, _b;
        const connection = this._connectionManager.getConnection(grouping.workspace);
        if (!connection) {
            return;
        }
        return {
            label: `$(radio-tower) ${connection.httpPort}`,
            description: (_b = (_a = grouping.workspace) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : localize('nonWorkspaceFiles', 'non-workspace files'),
            accept: () => {
                grouping.dispose();
            },
        };
    }
}
exports.Manager = Manager;
//# sourceMappingURL=manager.js.map