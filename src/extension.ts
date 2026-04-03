import * as vscode from 'vscode';

// Tree item representing a line containing the selected word
class LineItem extends vscode.TreeItem {
  constructor(
    public readonly lineNumber: number,
    public readonly lineText: string,
    public readonly filePath: string,
    totalLines: number,
    word: string
  ) {
    const digits = String(totalLines).length;
    const lineStr = String(lineNumber + 1).padStart(digits, '0');
    const prefix = `${lineStr}  `;
    const text = lineText.trim();

    super({ label: `${prefix}${text}` }, vscode.TreeItemCollapsibleState.None);

    this.tooltip = lineText;
    this.command = {
      command: 'blackDesert.goToLine',
      title: 'Go to line',
      arguments: [filePath, lineNumber, word]
    };
  }
}

// TreeDataProvider implementation for the "Word Lines" view
export class blackDesertProvider implements vscode.TreeDataProvider<LineItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private lines: LineItem[] = [];
  private currentWord: string = '';

  update(word: string, items: LineItem[]) {
    this.currentWord = word;
    this.lines = items;
    this._onDidChangeTreeData.fire();
  }

  clear() {
    this.currentWord = '';
    this.lines = [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: LineItem): vscode.TreeItem {
    return element;
  }

  getChildren(): LineItem[] {
    return this.lines;
  }
}

// Extension activation function
export function activate(context: vscode.ExtensionContext) {
  const provider = new blackDesertProvider();

  vscode.window.registerTreeDataProvider('blackDesert', provider);

	// Go to line command - navigate to the line and select the word
  context.subscriptions.push(
		vscode.commands.registerCommand('blackDesert.goToLine', async (filePath: string, lineNumber: number, word: string) => {
			const doc = await vscode.workspace.openTextDocument(filePath);
			const editor = await vscode.window.showTextDocument(doc);
		
			const line = doc.lineAt(lineNumber);
			const wordStart = line.text.indexOf(word);
			
			const start = new vscode.Position(lineNumber, wordStart);
			const end = new vscode.Position(lineNumber, wordStart + word.length);
		
			editor.selection = new vscode.Selection(start, end);
			editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
		})
  );

	// Listen for selection changes — update or keep, but don't clear
	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection(event => {
			const editor = event.textEditor;
			const word = editor.document.getText(editor.selection).trim();

			if (!word || word.includes('\n')) {
				return;
			}

			const filePath = editor.document.uri.fsPath;
			const allLines = editor.document.getText().split('\n');

			const matchingLines = allLines
				.map((lineText, index) => ({ lineText, index }))
				.filter(({ lineText }) => lineText.includes(word))
				.map(({ lineText, index }) => new LineItem(index, lineText, filePath, allLines.length, word));

			provider.update(word, matchingLines);
		})
	);

	// Clean only when the user types something, not on selection change
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(() => {
			provider.clear();
		})
	);
}

export function deactivate() {}