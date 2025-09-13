import * as vscode from "vscode";

export class CalculatorViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "hexmateCalculatorView";
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();
  }

  public sendValue(val: number) {
    this._view?.webview.postMessage({ command: "updateInput", value: val });
  }

  private getHtml(): string {
    return `<!doctype html>
<html>
<head>
  <style>
    body { background:#1e1e1e; color:#eee; font-family:sans-serif; padding:0.5rem; }
    input { width:100%; margin:5px 0; padding:4px; }
  </style>
</head>
<body>
  <h3>HexMate Calculator</h3>
  <input id="inputNum" placeholder="Enter number (0xFF, 42, 0b1010)" />
  <p>Decimal: <span id="decVal">-</span></p>
  <p>Hex: <span id="hexVal">-</span></p>
  <p>Binary: <span id="binVal">-</span></p>
  <p>Octal: <span id="octVal">-</span></p>
  <script>
    function parse(val) {
      if (!val) return NaN;
      if (val.startsWith("0x")) return parseInt(val,16);
      if (val.startsWith("0b")) return parseInt(val.slice(2),2);
      if (val.startsWith("0o")) return parseInt(val.slice(2),8);
      return parseInt(val,10);
    }
    function update() {
      const num = parse(document.getElementById("inputNum").value);
      if (isNaN(num)) return;
      decVal.innerText = num;
      hexVal.innerText = "0x"+num.toString(16).toUpperCase();
      binVal.innerText = "0b"+num.toString(2);
      octVal.innerText = "0o"+num.toString(8);
    }
    document.getElementById("inputNum").addEventListener("input", update);
    window.addEventListener("message", event => {
      if (event.data.command === "updateInput") {
        document.getElementById("inputNum").value = event.data.value;
        update();
      }
    });
  </script>
</body>
</html>`;
  }
}
