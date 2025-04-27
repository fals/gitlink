import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { SimpleGit } from 'simple-git';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	let sandbox: sinon.SinonSandbox;
	
	setup(() => {
		sandbox = sinon.createSandbox();
	});
	
	teardown(() => {
		sandbox.restore();
	});
	
	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('fals.gitlink'));
	});
	
	test('Should register command', () => {
		const commandSpy = sandbox.spy(vscode.commands, 'registerCommand');
		myExtension.activate({ subscriptions: [] } as any);
		assert.strictEqual(commandSpy.calledWith('gitlink.generateLink'), true);
	});
	
	test('Should show error when no active editor', async () => {
		// Mock active text editor to be undefined
		sandbox.stub(vscode.window, 'activeTextEditor').value(undefined);
		
		// Mock the showErrorMessage function
		const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
		
		// Execute the command
		await vscode.commands.executeCommand('gitlink.generateLink');
		
		// Verify error message was shown
		assert.strictEqual(showErrorStub.calledWith('No active editor found'), true);
	});
	
	test('Should generate GitHub link and copy to clipboard', async () => {
		// Setup mocks
		const document = {
			uri: {
				fsPath: '/path/to/file.ts'
			}
		};
		
		const selection = {
			active: { line: 9 } // 0-based index, should become line 10 in the URL
		};
		
		const editor = {
			document,
			selection
		};
		
		// Mock workspace folder
		const workspaceFolder = {
			uri: { fsPath: '/workspace' }
		};
		
		// Mock simpleGit methods
		const gitMock = {
			getRemotes: sandbox.stub().resolves([
				{ name: 'origin', refs: { fetch: 'https://github.com/owner/repo.git' } }
			]),
			revparse: sandbox.stub()
		};
		
		gitMock.revparse.withArgs(['--show-toplevel']).resolves('/workspace');
		gitMock.revparse.withArgs(['--abbrev-ref', 'HEAD']).resolves('main');
		
		// Stub the required VS Code APIs
		sandbox.stub(vscode.window, 'activeTextEditor').value(editor);
		sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(workspaceFolder as any);
		sandbox.stub(require('simple-git'), 'simpleGit').returns(gitMock as unknown as SimpleGit);
		
		const showInfoSpy = sandbox.stub(vscode.window, 'showInformationMessage');
		
		// Execute the command
		await vscode.commands.executeCommand('gitlink.generateLink');
		
		// Verify clipboard contains correct link
		const clipboardContent = await vscode.env.clipboard.readText();
		assert.strictEqual(clipboardContent, 'https://github.com/owner/repo/blob/main/../path/to/file.ts#L10');
		
		// Verify information message was shown
		assert.strictEqual(
			showInfoSpy.calledWith(sinon.match(/Link copied to clipboard/)),
			true
		);
	});
	
	// Test for GitLab link generation
	test('Should generate GitLab link correctly', async () => {
		// Similar setup as GitHub test but with GitLab URL
		const document = { uri: { fsPath: '/path/to/file.ts' } };
		const selection = { active: { line: 9 } };
		const editor = { document, selection };
		const workspaceFolder = { uri: { fsPath: '/workspace' } };
		
		const gitMock = {
			getRemotes: sandbox.stub().resolves([
				{ name: 'origin', refs: { fetch: 'https://gitlab.com/owner/repo.git' } }
			]),
			revparse: sandbox.stub()
		};
		
		gitMock.revparse.withArgs(['--show-toplevel']).resolves('/workspace');
		gitMock.revparse.withArgs(['--abbrev-ref', 'HEAD']).resolves('main');
		
		sandbox.stub(vscode.window, 'activeTextEditor').value(editor);
		sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(workspaceFolder as any);
		sandbox.stub(require('simple-git'), 'simpleGit').returns(gitMock as unknown as SimpleGit);
		
		// Execute the command
		await vscode.commands.executeCommand('gitlink.generateLink');
		
		
		// Verify clipboard contains correct GitLab link
		const clipboardContent = await vscode.env.clipboard.readText();
		assert.strictEqual(clipboardContent, 'https://gitlab.com/owner/repo/-/blob/main/../path/to/file.ts#L10');
	});
	
	test('Should handle error when no git remote found', async () => {
		// Setup mocks
		const document = { uri: { fsPath: '/path/to/file.ts' } };
		const selection = { active: { line: 9 } };
		const editor = { document, selection };
		const workspaceFolder = { uri: { fsPath: '/workspace' } };
		
		const gitMock = {
			getRemotes: sandbox.stub().resolves([]), // Empty remotes array
			revparse: sandbox.stub()
		};
		
		sandbox.stub(vscode.window, 'activeTextEditor').value(editor);
		sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(workspaceFolder as any);
		sandbox.stub(require('simple-git'), 'simpleGit').returns(gitMock as unknown as SimpleGit);
		
		const showErrorSpy = sandbox.stub(vscode.window, 'showErrorMessage');
		
		// Execute the command
		await vscode.commands.executeCommand('gitlink.generateLink');
		
		// Verify error message
		assert.strictEqual(showErrorSpy.calledWith('No git remote found'), true);
	});
});