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

// Tree item representing a file containing lines with the selected word
class FileItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly lines: LineItem[]
  ) {
    const fileName = filePath.split('/').pop() ?? filePath;
    const relativePath = vscode.workspace.asRelativePath(filePath); // Relative path

    super(fileName, vscode.TreeItemCollapsibleState.Expanded);
    this.tooltip = relativePath;
    this.iconPath = new vscode.ThemeIcon('file-code');
    this.description = relativePath;

    this.command = {
      command: 'vscode.open',
      title: 'Open file',
      arguments: [vscode.Uri.file(filePath)]
    };
  }
}

// TreeDataProvider implementation for the "Word Lines" view
export class blackDesertProvider implements vscode.TreeDataProvider<FileItem | LineItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private fileItems: FileItem[] = [];

  update(fileItems: FileItem[]) {
    this.fileItems = fileItems;
    this._onDidChangeTreeData.fire();
  }

  clear() {
    this.fileItems = [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FileItem | LineItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FileItem | LineItem): (FileItem | LineItem)[] {
    if (!element) {
      return this.fileItems;          // return files at root level
    }
    if (element instanceof FileItem) {
      return element.lines;           // file item has line items as children
    }
    return [];                        // don't return children for line items
  }
}

// Extension activation function
export function activate(context: vscode.ExtensionContext) {
  const provider = new blackDesertProvider();

  vscode.window.registerTreeDataProvider('blackDesert', provider);
	vscode.window.registerTreeDataProvider('blackDesert2', provider);

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
		vscode.window.onDidChangeTextEditorSelection(async event => {
			const editor = event.textEditor;
			const word = editor.document.getText(editor.selection).trim();
		
			if (!word || word.includes('\n')) {
				return;
			}
		
			const files = await vscode.workspace.findFiles(
				'**/*.{ts,tsx,js,jsx,json,css,scss,html,md,txt,py,java,c,cpp,h,go,rs}',
				'**/node_modules/**'
			);
			const allItems: LineItem[] = [];
		
			for (const fileUri of files) {
				try {
					const doc = await vscode.workspace.openTextDocument(fileUri);
					const allLines = doc.getText().split('\n');
			
					const matchingLines = allLines
						.map((lineText, index) => ({ lineText, index }))
						.filter(({ lineText }) => lineText.includes(word))
						.map(({ lineText, index }) => new LineItem(index, lineText, fileUri.fsPath, allLines.length, word));
			
					allItems.push(...matchingLines);
				} catch {
					// ignora arquivos binários e outros que não podem ser lidos como texto
				}
			}
		
			// group by file path
			const byFile = new Map<string, LineItem[]>();
			for (const item of allItems) {
				const existing = byFile.get(item.filePath) ?? [];
				existing.push(item);
				byFile.set(item.filePath, existing);
			}
			const currentFilePath = editor.document.uri.fsPath;

			// first sort by whether it's the current file, then by file path
			const sortedEntries = Array.from(byFile.entries()).sort(([a], [b]) => {
				if (a === currentFilePath) return -1;
				if (b === currentFilePath) return 1;
				return 0;
			});
			
			const fileItems = sortedEntries
				.map(([filePath, lines]) => new FileItem(filePath, lines));
		
			provider.update(fileItems);
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