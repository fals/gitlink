import * as vscode from 'vscode';
import * as path from 'path';
import * as simplegit from 'simple-git';

export function activate(context: vscode.ExtensionContext) {
	
	let disposable = vscode.commands.registerCommand('gitlink.generateLink', async () => {
		try {
			// Get the active text editor
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage('No active editor found');
				return;
			}
			
			// Get the current file path and cursor position
			const document = editor.document;
			const selection = editor.selection;
			const lineNumber = selection.active.line + 1; // 1-based line number for GitHub/GitLab
			const filePath = document.uri.fsPath;
			
			// Get the workspace folder containing the current file
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('File is not part of a workspace');
				return;
			}
			
			const git = simplegit(workspaceFolder.uri.fsPath);
			
			// Check if the file is under git control
			try {
				// Get the remote URL
				const remotes = await git.getRemotes(true);
				if (remotes.length === 0) {
					vscode.window.showErrorMessage('No git remote found');
					return;
				}
				
				// Get the default remote (usually origin)
				const remote = remotes.find(r => r.name === 'origin') || remotes[0];
				const remoteUrl = remote.refs.fetch;
				
				// Get the relative path of the file in the repository
				const repoRoot = await git.revparse(['--show-toplevel']);
				const relativeFilePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
				
				// Get the current branch or commit hash
				let ref: string;
				try {
					ref = await git.revparse(['--abbrev-ref', 'HEAD']);
					// If we're in detached HEAD state, get the commit hash instead
					if (ref === 'HEAD') {
						ref = await git.revparse(['HEAD']);
					}
				} catch (error) {
					ref = await git.revparse(['HEAD']);
				}
				
				// Extract owner and repo from the remote URL
				let link: string | null = null;
				
				// GitHub format
				if (remoteUrl.includes('github.com')) {
					const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
					if (match) {
						const [, owner, repo] = match;
						link = `https://github.com/${owner}/${repo}/blob/${ref}/${relativeFilePath}#L${lineNumber}`;
					}
				}
				// GitLab format
				else if (remoteUrl.includes('gitlab.com')) {
					const match = remoteUrl.match(/gitlab\.com[:/]([^/]+)\/([^/.]+)/);
					if (match) {
						const [, owner, repo] = match;
						link = `https://gitlab.com/${owner}/${repo}/-/blob/${ref}/${relativeFilePath}#L${lineNumber}`;
					}
				}
				// Self-hosted GitLab
				else if (remoteUrl.includes('gitlab')) {
					const urlParts = remoteUrl.split('@');
					let hostAndPath: string;
					
					if (urlParts.length > 1) {
						// SSH URL format
						hostAndPath = urlParts[1].replace(':', '/');
					} else {
						// HTTP URL format
						hostAndPath = remoteUrl.replace(/(https?:\/\/)/, '');
					}
					
					const pathParts = hostAndPath.split('/');
					// Remove .git extension if present in repo name
					const repoName = pathParts[pathParts.length - 1].replace('.git', '');
					const owner = pathParts[pathParts.length - 2];
					const host = pathParts[0];
					
					link = `https://${host}/${owner}/${repoName}/-/blob/${ref}/${relativeFilePath}#L${lineNumber}`;
				}
				// Other git providers can be added here
				
				if (link) {
					await vscode.env.clipboard.writeText(link);
					vscode.window.showInformationMessage(`Link copied to clipboard: ${link}`);
				} else {
					vscode.window.showErrorMessage('Could not generate link. Unsupported git provider.');
				}
				
			} catch (error) {
				vscode.window.showErrorMessage(`Error generating link: ${error instanceof Error ? error.message : String(error)}`);
			}
			
		} catch (error) {
			vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
		}
	});
	
	context.subscriptions.push(disposable);
}

export function deactivate() {}
