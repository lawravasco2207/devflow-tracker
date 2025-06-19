# DevFlow AI

An AI-powered code review extension for VS Code that integrates with GitHub and uses Gemini for intelligent code analysis.

## Features

- 🤖 AI-powered code review using Google's Gemini
- 🔄 Automatic git repository detection
- 📊 Real-time git status monitoring
- 🔍 Smart merge conflict resolution
- 📝 Detailed commit and change analysis
- 🚀 One-click repository cloning
- 💡 Intelligent code suggestions

## Requirements

- VS Code 1.80.0 or higher
- Node.js 16.x or higher
- Git installed on your system
- Backend service running on http://127.0.0.1:5000

## Installation

1. Install the extension from the VS Code Marketplace
2. Ensure the backend service is running
3. Open a git repository or file in VS Code

## Usage

### Review Current File
1. Open the file you want to review
2. Click the DevFlow status bar item or
3. Right-click in the editor and select "DevFlow: Review Current File with AI"

### Review GitHub PR/Commit
1. Use the command palette (Ctrl+Shift+P)
2. Type "DevFlow: Review Current File with AI"
3. Enter the GitHub PR or commit URL when prompted

### Git Integration
- The extension automatically detects git repositories
- Shows real-time status of commits and changes
- Provides merge conflict resolution options
- Offers repository cloning capabilities

## Extension Settings

This extension contributes the following settings:

* `devflow.backendUrl`: URL of the backend service (default: http://127.0.0.1:5000)

## Known Issues

- None at the moment

## Release Notes

### 1.0.0

Initial release of DevFlow AI:
- Basic code review functionality
- Git integration
- GitHub PR/commit review
- Real-time status monitoring

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 