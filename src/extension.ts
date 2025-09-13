import * as vscode from "vscode";
import { CalculatorViewProvider } from "./calculatorView";
import { BitfieldViewProvider } from "./bitfieldView";

let mode: "Decimal" | "Hex" | "Binary" | "Octal" = "Hex";
let decorationType: vscode.TextEditorDecorationType;
let decorationsEnabled = vscode.workspace.getConfiguration("hexmate").get("decorationsEnabled", true);

export function activate(context: vscode.ExtensionContext) {
  const calculatorProvider = new CalculatorViewProvider(context);
  const bitfieldProvider = new BitfieldViewProvider(context);

  // Register webview providers
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CalculatorViewProvider.viewType, calculatorProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(BitfieldViewProvider.viewType, bitfieldProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // Hover conversions
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: "file", language: "*" }, {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(
          position,
          /0x[0-9A-Fa-f]+|0b[01]+|0o[0-7]+|\b\d+\b/
        );
        if (!range) return;
        const text = document.getText(range);
        const num = parseNumber(text);
        if (num === null) return;

        const dec = num.toString(10);
        const hex = "0x" + num.toString(16).toUpperCase();
        const bin = "0b" + num.toString(2);
        const oct = "0o" + num.toString(8);

        const rangeArg = { start: range.start, end: range.end };
        const originalText = document.getText(range);

        function makeReplaceCommand(format: string, all: boolean = false, equivalent: boolean = false) {
          return `command:hexmate.replaceNumber?${encodeURIComponent(JSON.stringify({
            value: num,
            format,
            range: rangeArg,
            all,
            equivalent,
            originalText
          }))}`;
        }

        const md = new vscode.MarkdownString(undefined, true);
        md.isTrusted = true;

        md.appendMarkdown(`**${dec} ⟶ ${hex} | ${bin} | ${oct}**\n\n`);

        md.appendMarkdown(`### 🔢 Convert\n`);
        md.appendMarkdown(
          `- Dec: [Replace](${makeReplaceCommand("dec")}) | [All](${makeReplaceCommand("dec", true)}) | [All ≡](${makeReplaceCommand("dec", true, true)}) | [📋 Copy](command:hexmate.copyToClipboard?${encodeURIComponent(JSON.stringify({ text: dec, label: "Dec" }))}) → \`${dec}\`\n`
        );
        md.appendMarkdown(
          `- Hex: [Replace](${makeReplaceCommand("hex")}) | [All](${makeReplaceCommand("hex", true)}) | [All ≡](${makeReplaceCommand("hex", true, true)}) | [📋 Copy](command:hexmate.copyToClipboard?${encodeURIComponent(JSON.stringify({ text: hex, label: "Hex" }))}) → \`${hex}\`\n`
        );
        md.appendMarkdown(
          `- Bin: [Replace](${makeReplaceCommand("bin")}) | [All](${makeReplaceCommand("bin", true)}) | [All ≡](${makeReplaceCommand("bin", true, true)}) | [📋 Copy](command:hexmate.copyToClipboard?${encodeURIComponent(JSON.stringify({ text: bin, label: "Bin" }))}) → \`${bin}\`\n`
        );
        md.appendMarkdown(
          `- Oct: [Replace](${makeReplaceCommand("oct")}) | [All](${makeReplaceCommand("oct", true)}) | [All ≡](${makeReplaceCommand("oct", true, true)}) | [📋 Copy](command:hexmate.copyToClipboard?${encodeURIComponent(JSON.stringify({ text: oct, label: "Oct" }))}) → \`${oct}\`\n\n`
        );

        const hexBytes = num.toString(16).padStart(8, "0").match(/.{1,2}/g) || [];
        md.appendMarkdown(`📦 **Endianess**\n`);
        md.appendMarkdown(`- Big: ${hexBytes.join(" ")}\n`);
        md.appendMarkdown(`- Little: ${[...hexBytes].reverse().join(" ")}\n\n`);

        return new vscode.Hover(md, range);
      }
    })
  );

  // Status bar: number format
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "hexmate.toggleNumberFormat";
  updateStatusBar(statusBar);
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Status bar: decorations
  const decoBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  decoBar.command = "hexmate.toggleDecorations";
  updateDecoBar(decoBar);
  decoBar.show();
  context.subscriptions.push(decoBar);

  // Toggle number format
  context.subscriptions.push(
    vscode.commands.registerCommand("hexmate.toggleNumberFormat", async () => {
      const formats: ("Decimal" | "Hex" | "Binary" | "Octal")[] = ["Decimal", "Hex", "Binary", "Octal"];
      const idx = formats.indexOf(mode);
      mode = formats[(idx + 1) % formats.length];
      updateStatusBar(statusBar);
      await bulkReplaceActiveFile(mode);
    })
  );

  // Toggle decorations
  context.subscriptions.push(
    vscode.commands.registerCommand("hexmate.toggleDecorations", async () => {
      decorationsEnabled = !decorationsEnabled;
      await vscode.workspace.getConfiguration("hexmate")
        .update("decorationsEnabled", decorationsEnabled, vscode.ConfigurationTarget.Global);

      if (vscode.window.activeTextEditor) updateDecorations(vscode.window.activeTextEditor);
      updateDecoBar(decoBar);

      vscode.window.showInformationMessage(
        decorationsEnabled ? "HexMate: Decorations enabled" : "HexMate: Decorations disabled"
      );
    })
  );

  // Replace numbers
  context.subscriptions.push(
    vscode.commands.registerCommand("hexmate.replaceNumber", async (args) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !args) return;

      const { value, format, range, all, equivalent, originalText } = args;

      let replacement = "";
      switch (format) {
        case "dec": replacement = value.toString(10); break;
        case "hex": replacement = "0x" + value.toString(16).toUpperCase(); break;
        case "bin": replacement = "0b" + value.toString(2); break;
        case "oct": replacement = "0o" + value.toString(8); break;
      }

      if (all) {
        const text = editor.document.getText();
        const regex = /0x[0-9A-Fa-f]+|0b[01]+|0o[0-7]+|\b\d+\b/g;
        const edits: { range: vscode.Range; replacement: string }[] = [];

        const skipContexts: string[] = vscode.workspace.getConfiguration("hexmate").get("skipContexts", ["return", "case", "throw", "goto"]);
        const forbiddenRegex = new RegExp(`\\b(${skipContexts.join("|")})\\s*$`);

        for (const match of text.matchAll(regex)) {
          const val = parseNumber(match[0]);
          if (val === null) continue;

          const before = text.slice(Math.max(0, match.index! - 20), match.index!);
          if (forbiddenRegex.test(before)) continue;

          if (equivalent) {
            if (val !== value) continue;
          } else {
            if (match[0] !== originalText) continue;
          }

          const start = editor.document.positionAt(match.index!);
          const end = editor.document.positionAt(match.index! + match[0].length);
          edits.push({ range: new vscode.Range(start, end), replacement });
        }

        await editor.edit((builder) => {
          for (const e of edits) builder.replace(e.range, e.replacement);
        });
        updateDecorations(editor);
      } else {
        let targetRange: vscode.Range | undefined;
        if (range) {
          const start = new vscode.Position(range.start.line, range.start.character);
          const end = new vscode.Position(range.end.line, range.end.character);
          targetRange = new vscode.Range(start, end);
        } else {
          targetRange = editor.document.getWordRangeAtPosition(
            editor.selection.active,
            /0x[0-9A-Fa-f]+|0b[01]+|0o[0-7]+|\b\d+\b/
          );
        }
        if (targetRange) {
          await editor.edit((builder) => builder.replace(targetRange!, replacement));
          updateDecorations(editor);
        }
      }
    })
  );

  // Copy to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand("hexmate.copyToClipboard", async (args) => {
      if (!args || !args.text) return;
      await vscode.env.clipboard.writeText(args.text);
    })
  );

  // Decorations setup
  decorationType = vscode.window.createTextEditorDecorationType({
    after: { margin: "0 0 0 1em", color: new vscode.ThemeColor("editorCodeLens.foreground"), fontStyle: "italic" }
  });
  if (vscode.window.activeTextEditor) updateDecorations(vscode.window.activeTextEditor);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e) => e && updateDecorations(e))
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
        updateDecorations(vscode.window.activeTextEditor);
      }
    })
  );
}

export function deactivate() {}

function updateStatusBar(statusBar: vscode.StatusBarItem) {
  statusBar.text = `$(symbol-number) ${mode}`;
  statusBar.tooltip = `Click to toggle number format (current: ${mode})`;
}

function updateDecoBar(decoBar: vscode.StatusBarItem) {
  decoBar.text = decorationsEnabled ? "$(eye) Deco On" : "$(eye-closed) Deco Off";
  decoBar.tooltip = "Click to toggle inline annotations";
}

async function bulkReplaceActiveFile(format: "Decimal" | "Hex" | "Binary" | "Octal") {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  const text = doc.getText();
  const regex = /0x[0-9A-Fa-f]+|0b[01]+|0o[0-7]+|\b\d+\b/g;

  const edits: { range: vscode.Range; replacement: string }[] = [];
  for (const match of text.matchAll(regex)) {
    const val = parseNumber(match[0]);
    if (val === null) continue;
    const start = doc.positionAt(match.index!);
    const end = doc.positionAt(match.index! + match[0].length);

    let replacement = "";
    switch (format) {
      case "Decimal": replacement = val.toString(10); break;
      case "Hex": replacement = "0x" + val.toString(16).toUpperCase(); break;
      case "Binary": replacement = "0b" + val.toString(2); break;
      case "Octal": replacement = "0o" + val.toString(8); break;
    }

    edits.push({ range: new vscode.Range(start, end), replacement });
  }

  await editor.edit((editBuilder) => {
    for (const e of edits) editBuilder.replace(e.range, e.replacement);
  });
}

function updateDecorations(editor: vscode.TextEditor) {
  const config = vscode.workspace.getConfiguration("hexmate");
  const dualDisplay = config.get("dualDisplay") as boolean;

  if (!decorationsEnabled || !dualDisplay) {
    editor.setDecorations(decorationType, []);
    return;
  }

  const text = editor.document.getText();
  const regex = /0x[0-9A-Fa-f]+|0b[01]+|0o[0-7]+|\b\d+\b/g;

  const decos: vscode.DecorationOptions[] = [];
  for (const match of text.matchAll(regex)) {
    const num = parseNumber(match[0]);
    if (num === null) continue;

    const start = editor.document.positionAt(match.index!);
    const end = editor.document.positionAt(match.index! + match[0].length);
    const content = ` ⟶ Dec: ${num} | Hex: 0x${num.toString(16).toUpperCase()} | Bin: 0b${num.toString(2)} | Oct: 0o${num.toString(8)}`;
    decos.push({ range: new vscode.Range(start, end), renderOptions: { after: { contentText: content } } });
  }
  editor.setDecorations(decorationType, decos);
}

function parseNumber(text: string): number | null {
  if (text.startsWith("0x")) return parseInt(text, 16);
  if (text.startsWith("0b")) return parseInt(text.slice(2), 2);
  if (text.startsWith("0o")) return parseInt(text.slice(2), 8);
  return /^\d+$/.test(text) ? parseInt(text, 10) : null;
}
