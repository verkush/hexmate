// src/bitfieldView.ts
import * as vscode from "vscode";

/**
 * Sidebar Bitfield Visualizer (WebviewViewProvider)
 * - call sendValue(val, bitfields) from extension.ts to show a value + bitfield definitions
 * - bitfields expected as an object: { "RegisterName": { "0": "Carry", "1": { label: "Zero", doc: "..." } } }
 */
export class BitfieldViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "hexmateBitfieldView";
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    // If the webview wants to send messages to the extension, you can listen here:
    webviewView.webview.onDidReceiveMessage((msg) => {
      // e.g. open external links or respond to user interactions
      if (msg?.command === "openLink" && typeof msg.url === "string") {
        vscode.env.openExternal(vscode.Uri.parse(msg.url));
      }
    });
  }

  /**
   * Called from extension.ts to inject a value + bitfield definitions
   */
  public sendValue(val: number, bitfields: Record<string, any>) {
    // Ensure the view is created; if not, keep the message. The view will receive messages after it's created.
    this._view?.webview.postMessage({ value: val, bitfields });
  }

  private getHtml(): string {
    // Inline CSS + JS keeps file self-contained
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>HexMate Bitfield Visualizer</title>
  <style>
    :root { --bg:#1e1e1e; --panel:#151515; --muted:#9aa5b1; --accent:#4caf50; --card:#222; --gap:8px; }
    body { margin:0; padding:10px; background:var(--bg); color:#eee; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; font-size:13px; }
    h3 { margin: 0 0 8px 0; font-size:14px; color:#fff; }
    input { width:100%; padding:6px 8px; border-radius:4px; border:1px solid #333; background:var(--card); color: #eee; box-sizing:border-box; }
    .bit-row { display:flex; flex-wrap:wrap; gap:4px; margin:10px 0 8px 0; }
    .bit { width:26px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:4px; background:#2b2b2b; color:#ddd; font-size:11px; box-shadow: inset 0 -1px 0 rgba(0,0,0,.5); }
    .bit.active { background: var(--accent); color: #022b10; font-weight:700; }
    .field { border:1px solid #2d2d2d; background:#171717; padding:8px; border-radius:6px; margin:8px 0; }
    .field h4 { margin:0 0 6px 0; font-size:13px; color:#ffd54f; }
    .field p { margin:4px 0; font-size:12px; color:var(--muted); }
    .no-fields { margin-top:8px; color:var(--muted); font-size:12px; }
    .controls { display:flex; gap:8px; margin-top:8px; align-items:center; }
    .small { font-size:11px; color:var(--muted); }
    a.link { color:#7ec8ff; text-decoration:none; }
    .bits-container { max-height:160px; overflow:auto; padding-right:4px; }
  </style>
</head>
<body>
  <h3>Bitfield Visualizer</h3>
  <input id="inputNum" placeholder="Enter number (0xFF, 42, 0b1010)" />
  <div class="controls">
    <div class="small">32-bit view</div>
  </div>

  <div id="bitsWrapper" class="bits-container" aria-live="polite"></div>
  <div id="fields"></div>
  <div id="noFields" class="no-fields" style="display:none;">No bitfield definitions found in settings.</div>

  <script>
    const vscode = acquireVsCodeApi();

    function parseInput(val) {
      if (val === undefined || val === null) return NaN;
      if (typeof val === "number") return val;
      const s = String(val).trim();
      if (s.length === 0) return NaN;
      if (s.startsWith("0x") || s.startsWith("0X")) return parseInt(s.slice(2), 16);
      if (s.startsWith("0b") || s.startsWith("0B")) return parseInt(s.slice(2), 2);
      if (s.startsWith("0o") || s.startsWith("0O")) return parseInt(s.slice(2), 8);
      // decimal fallback (allow negative)
      return Number(s);
    }

    function renderBits(num) {
      const bitsWrapper = document.getElementById("bitsWrapper");
      bitsWrapper.innerHTML = "";
      if (!Number.isFinite(num)) {
        bitsWrapper.textContent = "No numeric value";
        return;
      }
      const bin = (num >>> 0).toString(2).padStart(32, "0"); // unsigned 32-bit
      const row = document.createElement("div");
      row.className = "bit-row";
      // show bits MSB (31) to LSB (0)
      for (let i = 0; i < bin.length; i++) {
        const bitIndex = 31 - i;
        const bitVal = bin.charAt(i);
        const div = document.createElement("div");
        div.className = "bit" + (bitVal === "1" ? " active" : "");
        div.title = "bit " + bitIndex;
        div.textContent = String(bitIndex);
        row.appendChild(div);
      }
      bitsWrapper.appendChild(row);
    }

    function renderFields(num, bitfields) {
      const container = document.getElementById("fields");
      const noFields = document.getElementById("noFields");
      container.innerHTML = "";

      if (!bitfields || Object.keys(bitfields).length === 0) {
        noFields.style.display = "block";
        return;
      }
      noFields.style.display = "none";

      for (const [regName, defs] of Object.entries(bitfields)) {
        const fieldDiv = document.createElement("div");
        fieldDiv.className = "field";
        const title = document.createElement("h4");
        title.textContent = regName;
        fieldDiv.appendChild(title);

        if (!defs || Object.keys(defs).length === 0) {
          const p = document.createElement("p");
          p.textContent = "(no definitions)";
          fieldDiv.appendChild(p);
          container.appendChild(fieldDiv);
          continue;
        }

        // defs expected as map: { "0": {label,doc} or "Zero" }
        const sortedBits = Object.keys(defs)
          .map(k => parseInt(k, 10))
          .filter(n => !Number.isNaN(n))
          .sort((a,b) => a - b);

        for (const bitIndex of sortedBits) {
          const info = defs[String(bitIndex)];
          const label = (typeof info === "string") ? info : (info && info.label) ? info.label : ("bit" + bitIndex);
          const doc = (typeof info === "string") ? null : (info && info.doc) ? info.doc : null;
          const isSet = ((num >>> 0) >> bitIndex) & 1;
          const p = document.createElement("p");
          p.textContent = label + ": " + (isSet ? "1" : "0");
          if (doc) {
            // show doc text; if it's a URL, make it clickable (will send message to extension)
            if ((typeof doc === "string") && (doc.startsWith("http://") || doc.startsWith("https://"))) {
              const a = document.createElement("a");
              a.className = "link";
              a.textContent = " [doc]";
              a.href = "#";
              a.addEventListener("click", (e) => {
                e.preventDefault();
                // ask extension to open external link
                vscode.postMessage({ command: "openLink", url: doc });
              });
              p.appendChild(a);
            } else {
              const span = document.createElement("span");
              span.style.color = "#9aa5b1";
              span.style.marginLeft = "6px";
              span.textContent = " — " + String(doc);
              p.appendChild(span);
            }
          }
          fieldDiv.appendChild(p);
        }
        container.appendChild(fieldDiv);
      }
    }

    // Render helper combining both
    function renderValue(val, bitfields) {
      const num = parseInput(val);
      if (!Number.isFinite(num) && typeof val === "string") {
        // try trimming and parse again
      }
      renderBits(num);
      renderFields(num, bitfields || {});
    }

    // Manual input
    const inputEl = document.getElementById("inputNum");
    inputEl.addEventListener("input", () => {
      const val = inputEl.value;
      renderValue(val, {}); // local quick render without bitfields
    });

    // Handle messages from the extension
    window.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.value === undefined) return;
      const value = data.value;
      const bitfields = data.bitfields || {};
      // pre-fill input and render full view with bitfields
      inputEl.value = (typeof value === "number") ? String(value) : String(value);
      renderValue(value, bitfields);
    });

    // initial attempt to load any pre-posted message (some hosts may post before listener is ready)
    // (nothing needed here; messages will be received via the above listener)
  </script>
</body>
</html>`;
  }
}
