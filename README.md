
# DevFlow AI - PR Summarizer

This is a simple prototype of DevFlow AI — a pull request review assistant using the Gemini API.

## Features
- Accepts raw GitHub diff input
- Uses Gemini to summarize changes and suggest test cases
- Runs on Flask

## Setup

1. Clone the repo and enter the folder:
```bash
pip install -r requirements.txt
```

2. Add your Gemini API key in a `.env` file:
```env
GEMINI_API_KEY=your-api-key-here
```

3. Run the app:
```bash
python app.py
```

Then open `http://127.0.0.1:5000` in your browser.
