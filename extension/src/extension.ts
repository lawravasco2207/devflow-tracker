import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import simpleGit from 'simple-git';
import fetch from 'node-fetch';

let statusBarItem: vscode.StatusBarItem;
let gitStatus: { behind: number; ahead: number; files: string[] } | null = null;
let extensionContext: vscode.ExtensionContext;

function findGitRoot(currentPath: string): string | null {
  let folder = currentPath;
  while (folder !== path.dirname(folder)) {
    if (fs.existsSync(path.join(folder, '.git'))) return folder;
    folder = path.dirname(folder);
  }
  return null;
}

async function updateGitStatus(gitRoot: string) {
  const git = simpleGit(gitRoot);
  try {
    const status = await git.status();
    gitStatus = {
      behind: status.behind,
      ahead: status.ahead,
      files: status.files.map(f => f.path)
    };
    updateStatusBarItem();
  } catch (err) {
    gitStatus = null;
    updateStatusBarItem();
  }
}

function updateStatusBarItem() {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    statusBarItem.command = 'extension.devflowReview';
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
    statusBarItem.tooltip = 'Click to review with DevFlow AI';
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

async function getGitRemoteUrl(repoPath: string): Promise<string | null> {
  const git = simpleGit(repoPath);
  try {
    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');
    return origin?.refs.fetch || null;
  } catch {
    return null;
  }
}

async function getGitDiff(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);
  try {
    return await git.diff();
  } catch (err) {
    throw new Error("Failed to get diff");
  }
}

async function getLastCommitDetails(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);
  const log = await git.log({ n: 1 });
  const last = log.latest;
  return `Last commit: ${last?.message} by ${last?.author_name} on ${last?.date}`;
}

async function checkMergeStatus(repoPath: string): Promise<string | null> {
  const git = simpleGit(repoPath);
  try {
    const status = await git.status();
    if (status.behind > 0) {
      return `Behind by ${status.behind} commits. Merge required.`;
    }
    return null;
  } catch {
    return null;
  }
}

async function suggestFixesFromHistory(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);
  const log = await git.log({ n: 5 });
  return log.all.map((entry, idx) => `Fix ${idx + 1}: ${entry.message}`).join('\n');
}

async function blameLine(filePath: string, lineNumber: number): Promise<string> {
  const folder = path.dirname(filePath);
  const git = simpleGit(folder);
  try {
    const result = await git.raw(['blame', '-L', `${lineNumber},${lineNumber}`, filePath]);
    return result;
  } catch (err) {
    throw new Error("Failed to run git blame");
  }
}

async function pullLatestChanges(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);
  try {
    const result = await git.pull();
    return JSON.stringify(result.summary);
  } catch (err) {
    throw new Error("Failed to pull latest changes");
  }
}

async function pushChanges(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);
  try {
    await git.push();
    return "✅ Changes pushed successfully.";
  } catch (err) {
    throw new Error("❌ Push failed. Resolve conflicts first.");
  }
}

async function cloneRepository(url: string, targetPath: string): Promise<string> {
  const git = simpleGit();
  try {
    await git.clone(url, targetPath);
    return "✅ Repository cloned successfully.";
  } catch (err) {
    throw new Error("❌ Failed to clone repository");
  }
}

async function getRepositoryInfo(repoPath: string): Promise<{
  lastCommit: string;
  branch: string;
  remote: string | null;
  changes: string[];
}> {
  const git = simpleGit(repoPath);
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
  } catch (err) {
    throw new Error("Failed to get repository information");
  }
}

async function showReviewPanel(html: string, title: string = 'DevFlow Review Result') {
  const panel = vscode.window.createWebviewPanel(
    'devflowResult',
    title,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );
  panel.webview.html = html;
  return panel;
}

async function handleGitRepository(gitRoot: string, editor: vscode.TextEditor) {
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
    const mergeChoice = await vscode.window.showQuickPick(
      ['Merge Changes', 'Skip Merge', 'View Changes', 'Stash & Merge'],
      { placeHolder: `Behind by ${gitStatus.behind} commits. What would you like to do?` }
    );

    const git = simpleGit(gitRoot);
    switch (mergeChoice) {
      case 'Merge Changes':
        await git.pull();
        vscode.window.showInformationMessage("✅ Merge successful.");
        break;
      case 'View Changes':
        const diff = await git.diff();
        await showReviewPanel(`<pre>${diff}</pre>`, 'Repository Changes');
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
  const git = simpleGit(gitRoot);
  const diff = await git.diff();
  const postData = { 
    file_content: diff.length > 20 ? diff : editor.document.getText(),
    repo_info: JSON.stringify(repoInfo)
  };

  const res = await fetch('http://127.0.0.1:5000/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(postData)
  });

  const html = await res.text();
  await showReviewPanel(html);
}

async function handleNonGitRepository() {
  const prUrl = await vscode.window.showInputBox({
    prompt: "Enter GitHub PR, commit, or diff URL:",
    placeHolder: "https://github.com/user/repo/pull/123 or https://github.com/user/repo/commit/abc123"
  });

  if (!prUrl) return;

  const cloneChoice = await vscode.window.showQuickPick(
    ['Yes', 'No', 'Clone & Open in New Window'],
    { placeHolder: 'Would you like to clone this repository?' }
  );

  if (cloneChoice) {
    const targetPath = await vscode.window.showInputBox({
      prompt: "Enter target directory path:",
      placeHolder: "C:/Users/username/projects/repo-name"
    });

    if (targetPath) {
      const git = simpleGit();
      await git.clone(prUrl, targetPath);
      
      if (cloneChoice === 'Clone & Open in New Window') {
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath), true);
      } else {
        vscode.window.showInformationMessage("Repository cloned successfully.");
      }
    }
  }

  const res = await fetch('http://127.0.0.1:5000/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ pr_url: prUrl })
  });

  const html = await res.text();
  await showReviewPanel(html);
}

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;
  
  // Register the main review command
  context.subscriptions.push(vscode.commands.registerCommand('extension.devflowReview', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No file is open.");
      return;
    }

    const filePath = editor.document.fileName;
    const gitRoot = findGitRoot(filePath);

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "DevFlow AI Reviewing...",
      cancellable: false
    }, async () => {
      try {
        if (gitRoot) {
          await handleGitRepository(gitRoot, editor);
        } else {
          await handleNonGitRepository();
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`❌ DevFlow Error: ${err.message}`);
      }
    });
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

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
