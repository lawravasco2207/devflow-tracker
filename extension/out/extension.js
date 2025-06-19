"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const simple_git_1 = __importDefault(require("simple-git"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const panel_1 = require("./panel");
let statusBarItem;
let gitStatus = null;
let extensionContext;
function findGitRoot(currentPath) {
    let folder = currentPath;
    while (folder !== path.dirname(folder)) {
        if (fs.existsSync(path.join(folder, '.git')))
            return folder;
        folder = path.dirname(folder);
    }
    return null;
}
async function updateGitStatus(gitRoot) {
    const git = (0, simple_git_1.default)(gitRoot);
    try {
        const status = await git.status();
        gitStatus = {
            behind: status.behind,
            ahead: status.ahead,
            files: status.files.map(f => f.path)
        };
        updateStatusBarItem();
    }
    catch (err) {
        gitStatus = null;
        updateStatusBarItem();
    }
}
function updateStatusBarItem() {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.command = 'devflow.openChatSidebar';
        extensionContext.subscriptions.push(statusBarItem);
    }
    if (gitStatus) {
        let text = '$(git-branch) DevFlow';
        if (gitStatus.behind > 0) {
            text += ` $(arrow-down)${gitStatus.behind}`;
        }
        if (gitStatus.ahead > 0) {
            text += ` $(arrow-up)${gitStatus.ahead}`;
        }
        if (gitStatus.files.length > 0) {
            text += ` $(pencil)${gitStatus.files.length}`;
        }
        statusBarItem.text = text;
        statusBarItem.tooltip = 'Open DevFlow AI Chat Sidebar';
        statusBarItem.show();
    }
    else {
        statusBarItem.hide();
    }
}
async function getGitRemoteUrl(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    try {
        const remotes = await git.getRemotes(true);
        const origin = remotes.find(r => r.name === 'origin');
        return origin?.refs.fetch || null;
    }
    catch {
        return null;
    }
}
async function getGitDiff(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    try {
        return await git.diff();
    }
    catch (err) {
        throw new Error("Failed to get diff");
    }
}
async function getLastCommitDetails(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    const log = await git.log({ n: 1 });
    const last = log.latest;
    return `Last commit: ${last?.message} by ${last?.author_name} on ${last?.date}`;
}
async function checkMergeStatus(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    try {
        const status = await git.status();
        if (status.behind > 0) {
            return `Behind by ${status.behind} commits. Merge required.`;
        }
        return null;
    }
    catch {
        return null;
    }
}
async function suggestFixesFromHistory(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    const log = await git.log({ n: 5 });
    return log.all.map((entry, idx) => `Fix ${idx + 1}: ${entry.message}`).join('\n');
}
async function blameLine(filePath, lineNumber) {
    const folder = path.dirname(filePath);
    const git = (0, simple_git_1.default)(folder);
    try {
        const result = await git.raw(['blame', '-L', `${lineNumber},${lineNumber}`, filePath]);
        return result;
    }
    catch (err) {
        throw new Error("Failed to run git blame");
    }
}
async function pullLatestChanges(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    try {
        const result = await git.pull();
        return JSON.stringify(result.summary);
    }
    catch (err) {
        throw new Error("Failed to pull latest changes");
    }
}
async function pushChanges(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    try {
        await git.push();
        return "✅ Changes pushed successfully.";
    }
    catch (err) {
        throw new Error("❌ Push failed. Resolve conflicts first.");
    }
}
async function cloneRepository(url, targetPath) {
    const git = (0, simple_git_1.default)();
    try {
        await git.clone(url, targetPath);
        return "✅ Repository cloned successfully.";
    }
    catch (err) {
        throw new Error("❌ Failed to clone repository");
    }
}
async function getRepositoryInfo(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    try {
        const [log, status, branch, remotes] = await Promise.all([
            git.log({ n: 1 }),
            git.status(),
            git.revparse(['--abbrev-ref', 'HEAD']),
            git.getRemotes(true)
        ]);
        return {
            lastCommit: `Last commit: ${log.latest?.message} by ${log.latest?.author_name} on ${log.latest?.date}`,
            branch,
            remote: remotes.find(r => r.name === 'origin')?.refs.fetch || null,
            changes: status.files.map(f => f.path)
        };
    }
    catch (err) {
        throw new Error("Failed to get repository information");
    }
}
// Helper to parse chat input and route to git or AI
async function handleChatInput(text, gitRoot) {
    const git = gitRoot ? (0, simple_git_1.default)(gitRoot) : null;
    const trimmed = text.trim();
    try {
        if (/^\/help$/i.test(trimmed)) {
            return `Available commands:\nstatus, log, pull, push, commit <msg>, diff, branch, checkout <branch>, create-branch <name>, stash, stash pop, reset, revert <commit>, show <commit>, blame <file> <line>, /help.\nOr ask a question for AI help.`;
        }
        else if (git && /^status$/i.test(trimmed)) {
            const status = await git.status();
            return `On branch: ${status.current}\nStaged: ${status.staged.length}\nChanged: ${status.files.length}\nConflicted: ${status.conflicted.length}`;
        }
        else if (git && /^log$/i.test(trimmed)) {
            const log = await git.log({ n: 5 });
            return log.all.map(l => `${l.hash.slice(0, 7)}: ${l.message} (${l.author_name})`).join('\n');
        }
        else if (git && /^pull$/i.test(trimmed)) {
            await git.pull();
            return '✅ Pulled latest changes.';
        }
        else if (git && /^push$/i.test(trimmed)) {
            await git.push();
            return '✅ Pushed changes.';
        }
        else if (git && /^commit (.+)$/i.test(trimmed)) {
            const m = trimmed.match(/^commit (.+)$/i);
            if (m) {
                await git.commit(m[1]);
                return `✅ Committed: ${m[1]}`;
            }
        }
        else if (git && /^diff$/i.test(trimmed)) {
            const diff = await git.diff();
            return diff.length ? diff.slice(0, 2000) : 'No diff.';
        }
        else if (git && /^branch$/i.test(trimmed)) {
            const branches = await git.branch();
            return `Branches:\n${Object.keys(branches.branches).join(', ')}\nCurrent: ${branches.current}`;
        }
        else if (git && /^checkout (.+)$/i.test(trimmed)) {
            const m = trimmed.match(/^checkout (.+)$/i);
            if (m) {
                await git.checkout(m[1]);
                return `✅ Checked out branch: ${m[1]}`;
            }
        }
        else if (git && /^create-branch (.+)$/i.test(trimmed)) {
            const m = trimmed.match(/^create-branch (.+)$/i);
            if (m) {
                await git.checkoutLocalBranch(m[1]);
                return `✅ Created and checked out branch: ${m[1]}`;
            }
        }
        else if (git && /^stash$/i.test(trimmed)) {
            await git.stash();
            return '✅ Stashed changes.';
        }
        else if (git && /^stash pop$/i.test(trimmed)) {
            await git.stash(['pop']);
            return '✅ Popped stash.';
        }
        else if (git && /^reset$/i.test(trimmed)) {
            await git.reset();
            return '✅ Reset complete.';
        }
        else if (git && /^revert (.+)$/i.test(trimmed)) {
            const m = trimmed.match(/^revert (.+)$/i);
            if (m) {
                await git.revert(m[1]);
                return `✅ Reverted commit: ${m[1]}`;
            }
        }
        else if (git && /^show (.+)$/i.test(trimmed)) {
            const m = trimmed.match(/^show (.+)$/i);
            if (m) {
                const out = await git.show([m[1]]);
                return out.length > 2000 ? out.slice(0, 2000) : out;
            }
        }
        else if (git && /^blame (.+) (\d+)$/i.test(trimmed)) {
            const m = trimmed.match(/^blame (.+) (\d+)$/i);
            if (m) {
                const out = await git.raw(['blame', '-L', `${m[2]},${m[2]}`, m[1]]);
                return out;
            }
        }
        else if (git) {
            // If not a recognized git command, treat as AI question
            const aiRes = await (0, node_fetch_1.default)('http://127.0.0.1:5000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: trimmed })
            });
            if (aiRes.ok) {
                const data = await aiRes.json();
                return data.ai_response || 'AI did not return a response.';
            }
            else {
                return 'AI backend not available.';
            }
        }
        else {
            return 'No git repository detected.';
        }
    }
    catch (err) {
        return '❌ Error: ' + (err.message || err.toString());
    }
    // Default return for type safety
    return 'Unknown error.';
}
async function showReviewPanel(html, title = 'DevFlow Review Result', gitRoot) {
    const panel = vscode.window.createWebviewPanel('devflowResult', title, vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true
    });
    panel.webview.html = html;
    panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === 'chat') {
            const response = await handleChatInput(msg.text, gitRoot);
            panel.webview.postMessage({ type: 'chatResponse', text: response });
        }
    });
    return panel;
}
async function handleGitRepository(gitRoot, editor) {
    const repoInfo = await getRepositoryInfo(gitRoot);
    // Show repository info
    const infoMessage = [
        repoInfo.lastCommit,
        `Branch: ${repoInfo.branch}`,
        repoInfo.remote ? `Remote: ${repoInfo.remote}` : 'No remote configured',
        repoInfo.changes.length > 0 ? `Changes: ${repoInfo.changes.length} files` : 'No changes'
    ].join('\n');
    vscode.window.showInformationMessage(infoMessage);
    // Handle merge status
    if (gitStatus && gitStatus.behind && gitStatus.behind > 0) {
        const mergeChoice = await vscode.window.showQuickPick(['Merge Changes', 'Skip Merge', 'View Changes', 'Stash & Merge'], { placeHolder: `Behind by ${gitStatus.behind} commits. What would you like to do?` });
        const git = (0, simple_git_1.default)(gitRoot);
        switch (mergeChoice) {
            case 'Merge Changes':
                await git.pull();
                vscode.window.showInformationMessage("✅ Merge successful.");
                break;
            case 'View Changes':
                const diff = await git.diff();
                await showReviewPanel(`<pre>${diff}</pre>`, 'Repository Changes', gitRoot);
                break;
            case 'Stash & Merge':
                await git.stash();
                await git.pull();
                await git.stash(['pop']);
                vscode.window.showInformationMessage("✅ Stash, merge, and pop successful.");
                break;
        }
    }
    // Get diff and send for review
    const git = (0, simple_git_1.default)(gitRoot);
    const diff = await git.diff();
    const postData = {
        file_content: diff.length > 20 ? diff : editor.document.getText(),
        repo_info: JSON.stringify(repoInfo)
    };
    const res = await (0, node_fetch_1.default)('http://127.0.0.1:5000/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(postData)
    });
    const html = await res.text();
    await showReviewPanel(html, 'DevFlow Review Result', gitRoot);
}
async function handleNonGitRepository() {
    const prUrl = await vscode.window.showInputBox({
        prompt: "Enter GitHub PR, commit, or diff URL:",
        placeHolder: "https://github.com/user/repo/pull/123 or https://github.com/user/repo/commit/abc123"
    });
    if (!prUrl)
        return;
    const cloneChoice = await vscode.window.showQuickPick(['Yes', 'No', 'Clone & Open in New Window'], { placeHolder: 'Would you like to clone this repository?' });
    if (cloneChoice) {
        const targetPath = await vscode.window.showInputBox({
            prompt: "Enter target directory path:",
            placeHolder: "C:/Users/username/projects/repo-name"
        });
        if (targetPath) {
            const git = (0, simple_git_1.default)();
            await git.clone(prUrl, targetPath);
            if (cloneChoice === 'Clone & Open in New Window') {
                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath), true);
            }
            else {
                vscode.window.showInformationMessage("Repository cloned successfully.");
            }
        }
    }
    const res = await (0, node_fetch_1.default)('http://127.0.0.1:5000/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ pr_url: prUrl })
    });
    const html = await res.text();
    await showReviewPanel(html);
}
// --- Sidebar Chat Provider ---
class DevFlowChatProvider {
    constructor(context) {
        this._context = context;
    }
    async resolveWebviewView(view, context, _token) {
        this._view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = (0, panel_1.getSidebarWebviewContent)();
        this.setMessageHandler();
    }
    setMessageHandler() {
        if (!this._view)
            return;
        this._view.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'chat') {
                const response = await this.handleChatInput(msg.text);
                this._view?.webview.postMessage({ type: 'chatResponse', text: response });
            }
            else if (msg.type === 'getContext') {
                const context = await this.getGitContext();
                this._view?.webview.postMessage({ type: 'context', ...context });
            }
        });
    }
    // Find the git root for the current workspace
    async findGitRoot() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0)
            return undefined;
        let folder = folders[0].uri.fsPath;
        while (folder !== path.dirname(folder)) {
            if (fs.existsSync(path.join(folder, '.git')))
                return folder;
            folder = path.dirname(folder);
        }
        return undefined;
    }
    // Get git context for the sidebar (repo, branch, last commit, etc.)
    async getGitContext() {
        if (!this._gitRoot)
            return { repo: null };
        const git = (0, simple_git_1.default)(this._gitRoot);
        try {
            const [log, status, branch, remotes] = await Promise.all([
                git.log({ n: 1 }),
                git.status(),
                git.revparse(['--abbrev-ref', 'HEAD']),
                git.getRemotes(true)
            ]);
            return {
                repo: path.basename(this._gitRoot),
                branch,
                lastCommit: log.latest?.message || '',
                author: log.latest?.author_name || '',
                date: log.latest?.date || '',
                changes: status.files.length,
                conflicted: status.conflicted.length,
                remote: remotes.find(r => r.name === 'origin')?.refs.fetch || null
            };
        }
        catch {
            return { repo: null };
        }
    }
    // Handle chat input: route to git or AI
    async handleChatInput(text) {
        const git = this._gitRoot ? (0, simple_git_1.default)(this._gitRoot) : null;
        const trimmed = text.trim();
        try {
            if (/^\/help$/i.test(trimmed)) {
                return `Available commands:\nstatus, log, pull, push, commit <msg>, diff, branch, checkout <branch>, create-branch <name>, stash, stash pop, reset, revert <commit>, show <commit>, blame <file> <line>, /help.\nOr ask a question for AI help.`;
            }
            else if (git && /^status$/i.test(trimmed)) {
                const status = await git.status();
                return `On branch: ${status.current}\nStaged: ${status.staged.length}\nChanged: ${status.files.length}\nConflicted: ${status.conflicted.length}`;
            }
            else if (git && /^log$/i.test(trimmed)) {
                const log = await git.log({ n: 5 });
                return log.all.map(l => `${l.hash.slice(0, 7)}: ${l.message} (${l.author_name})`).join('\n');
            }
            else if (git && /^pull$/i.test(trimmed)) {
                await git.pull();
                return '✅ Pulled latest changes.';
            }
            else if (git && /^push$/i.test(trimmed)) {
                await git.push();
                return '✅ Pushed changes.';
            }
            else if (git && /^commit (.+)$/i.test(trimmed)) {
                const m = trimmed.match(/^commit (.+)$/i);
                if (m) {
                    await git.commit(m[1]);
                    return `✅ Committed: ${m[1]}`;
                }
            }
            else if (git && /^diff$/i.test(trimmed)) {
                const diff = await git.diff();
                return diff.length ? diff.slice(0, 2000) : 'No diff.';
            }
            else if (git && /^branch$/i.test(trimmed)) {
                const branches = await git.branch();
                return `Branches:\n${Object.keys(branches.branches).join(', ')}\nCurrent: ${branches.current}`;
            }
            else if (git && /^checkout (.+)$/i.test(trimmed)) {
                const m = trimmed.match(/^checkout (.+)$/i);
                if (m) {
                    await git.checkout(m[1]);
                    return `✅ Checked out branch: ${m[1]}`;
                }
            }
            else if (git && /^create-branch (.+)$/i.test(trimmed)) {
                const m = trimmed.match(/^create-branch (.+)$/i);
                if (m) {
                    await git.checkoutLocalBranch(m[1]);
                    return `✅ Created and checked out branch: ${m[1]}`;
                }
            }
            else if (git && /^stash$/i.test(trimmed)) {
                await git.stash();
                return '✅ Stashed changes.';
            }
            else if (git && /^stash pop$/i.test(trimmed)) {
                await git.stash(['pop']);
                return '✅ Popped stash.';
            }
            else if (git && /^reset$/i.test(trimmed)) {
                await git.reset();
                return '✅ Reset complete.';
            }
            else if (git && /^revert (.+)$/i.test(trimmed)) {
                const m = trimmed.match(/^revert (.+)$/i);
                if (m) {
                    await git.revert(m[1]);
                    return `✅ Reverted commit: ${m[1]}`;
                }
            }
            else if (git && /^show (.+)$/i.test(trimmed)) {
                const m = trimmed.match(/^show (.+)$/i);
                if (m) {
                    const out = await git.show([m[1]]);
                    return out.length > 2000 ? out.slice(0, 2000) : out;
                }
            }
            else if (git && /^blame (.+) (\d+)$/i.test(trimmed)) {
                const m = trimmed.match(/^blame (.+) (\d+)$/i);
                if (m) {
                    const out = await git.raw(['blame', '-L', `${m[2]},${m[2]}`, m[1]]);
                    return out;
                }
            }
            else if (git) {
                // If not a recognized git command, treat as AI question
                const aiRes = await (0, node_fetch_1.default)('http://127.0.0.1:5000/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: trimmed })
                });
                if (aiRes.ok) {
                    const data = await aiRes.json();
                    return data.ai_response || 'AI did not return a response.';
                }
                else {
                    return 'AI backend not available.';
                }
            }
            else {
                return 'No git repository detected.';
            }
        }
        catch (err) {
            return '❌ Error: ' + (err.message || err.toString());
        }
        return 'Unknown error.';
    }
}
DevFlowChatProvider.viewType = 'devflow.chatView';
// --- Extension Activation ---
function activate(context) {
    extensionContext = context;
    // Register the sidebar chat view
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(DevFlowChatProvider.viewType, new DevFlowChatProvider(context)));
    // Register a command to open the sidebar chat
    context.subscriptions.push(vscode.commands.registerCommand('devflow.openChatSidebar', async () => {
        await vscode.commands.executeCommand('devflow.chatView.focus');
    }));
    // Add a status bar item to open the chat sidebar
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(git-branch) DevFlow';
    statusBarItem.tooltip = 'Open DevFlow AI Chat Sidebar';
    statusBarItem.command = 'devflow.openChatSidebar';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // Retain the main review command (panel)
    context.subscriptions.push(vscode.commands.registerCommand('extension.devflowReview', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No file is open.");
            return;
        }
        await showReviewPanel('<h2>DevFlow Review (Panel)</h2><p>Use the sidebar for full chat experience.</p>');
    }));
    // Watch for file changes to update git status
    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    context.subscriptions.push(fileSystemWatcher);
    fileSystemWatcher.onDidChange(async (uri) => {
        const gitRoot = findGitRoot(uri.fsPath);
        if (gitRoot) {
            await updateGitStatus(gitRoot);
        }
    });
    fileSystemWatcher.onDidCreate(async (uri) => {
        const gitRoot = findGitRoot(uri.fsPath);
        if (gitRoot) {
            await updateGitStatus(gitRoot);
        }
    });
    fileSystemWatcher.onDidDelete(async (uri) => {
        const gitRoot = findGitRoot(uri.fsPath);
        if (gitRoot) {
            await updateGitStatus(gitRoot);
        }
    });
    // Initial status update
    if (vscode.window.activeTextEditor) {
        const gitRoot = findGitRoot(vscode.window.activeTextEditor.document.fileName);
        if (gitRoot) {
            updateGitStatus(gitRoot).catch(err => {
                vscode.window.showErrorMessage(`Failed to update git status: ${err.message}`);
            });
        }
    }
}
function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
//# sourceMappingURL=extension.js.map