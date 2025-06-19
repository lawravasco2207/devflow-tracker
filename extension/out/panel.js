"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebviewContent = getWebviewContent;
function getWebviewContent(content) {
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevFlow AI Review</title>
    <style>
      body {
        font-family: sans-serif;
        padding: 1rem;
        background: #0d1117;
        color: #c9d1d9;
      }
      pre {
        background: #161b22;
        padding: 1rem;
        border-radius: 8px;
        overflow-x: auto;
      }
    </style>
  </head>
  <body>
    <h2>DevFlow AI Summary</h2>
    <div>${content}</div>
  </body>
  </html>
  `;
}
//# sourceMappingURL=panel.js.map